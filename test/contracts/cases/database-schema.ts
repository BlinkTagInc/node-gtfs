import type { TestRepository } from '../../helpers/query-test-types.ts';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { Kysely, sql } from 'kysely';
import { Gtfs, isGtfsError, GtfsErrorCode } from '../../../src/index.ts';
import {
  createKyselyGtfsIndexes,
  createKyselyGtfsTables,
  type GtfsDatabaseDialect,
  type GtfsSchemaInspection,
  type GtfsTableSchemaIssue,
  inspectKyselyGtfsSchema,
} from '../../../src/kysely.ts';
import type { ConformanceDatabase } from './database-types.ts';

type SchemaDriftKind =
  | 'missing-storage-key'
  | 'wrong-storage-key'
  | 'wrong-index-columns'
  | 'wrong-index-order'
  | 'wrong-default'
  | 'wrong-generated-expression'
  | 'incompatible-generated-column'
  | 'missing-column'
  | 'missing-default'
  | 'missing-index'
  | 'unexpected-column-type'
  | 'wrong-nullability';
interface SchemaDriftCase {
  readonly name: string;
  readonly kind: SchemaDriftKind;
  readonly tableName: string;
  readonly verify: (issue: GtfsTableSchemaIssue) => void;
}
const schemaDriftCases: readonly SchemaDriftCase[] = [
  ...(['missing-storage-key', 'wrong-storage-key'] as const).map((kind) => ({
    name: kind,
    kind,
    tableName: 'routes',
    verify: (issue: GtfsTableSchemaIssue) =>
      assert.equal(issue.incompatibleStorageKey, true),
  })),
  ...(['wrong-index-columns', 'wrong-index-order'] as const).map((kind) => ({
    name: kind,
    kind,
    tableName: 'transfers',
    verify: (issue: GtfsTableSchemaIssue) =>
      assert.deepEqual(issue.incompatibleIndexes, ['idx_transfers_to_stop_id']),
  })),
  {
    name: 'wrong default',
    kind: 'wrong-default',
    tableName: 'transfers',
    verify: (issue) =>
      assert.deepEqual(issue.incompatibleDefaults, ['transfer_type']),
  },
  {
    name: 'wrong generated expression',
    kind: 'wrong-generated-expression',
    tableName: 'stop_times',
    verify: (issue) =>
      assert.deepEqual(issue.incompatibleGeneratedColumns, [
        'departure_service_day_seconds',
      ]),
  },
  {
    name: 'missing columns',
    kind: 'missing-column',
    tableName: 'agency',
    verify: (issue) => {
      assert.deepEqual(issue.missingColumns, ['agency_url']);
    },
  },
  {
    name: 'wrong nullability',
    kind: 'wrong-nullability',
    tableName: 'agency',
    verify: (issue) => {
      assert.deepEqual(issue.unexpectedlyNullableColumns, ['agency_name']);
    },
  },
  {
    name: 'missing defaults',
    kind: 'missing-default',
    tableName: 'transfers',
    verify: (issue) => {
      assert.deepEqual(issue.missingDefaultColumns, ['transfer_type']);
    },
  },
  {
    name: 'missing indexes',
    kind: 'missing-index',
    tableName: 'transfers',
    verify: (issue) => {
      assert.deepEqual(issue.missingIndexes, ['idx_transfers_to_stop_id']);
    },
  },
  {
    name: 'incompatible generated columns',
    kind: 'incompatible-generated-column',
    tableName: 'stop_times',
    verify: (issue) => {
      assert.deepEqual(issue.incompatibleGeneratedColumns, [
        'departure_service_day_seconds',
      ]);
    },
  },
  {
    name: 'unexpected schema shape',
    kind: 'unexpected-column-type',
    tableName: 'agency',
    verify: (issue) => {
      assert.deepEqual(
        issue.incompatibleColumnTypes.map(({ actualType, ...typeIssue }) => ({
          ...typeIssue,
          actualType: typeof actualType,
        })),
        [
          {
            columnName: 'agency_name',
            expectedType: 'text',
            actualType: 'string',
          },
        ],
      );
    },
  },
];
function replaceSqlPattern(
  statement: string,
  expected: RegExp,
  replacement: string,
): string {
  const replaced = statement.replace(expected, replacement);
  assert.notEqual(
    replaced,
    statement,
    `Expected SQLite schema to match ${expected}`,
  );
  return replaced;
}
async function rebuildSqliteTable(
  db: Kysely<ConformanceDatabase>,
  tableName: string,
  transform: (statement: string) => string,
): Promise<void> {
  const tableDefinition = await sql<{
    sql: string | null;
  }>`
    select sql from sqlite_master
    where type = 'table' and name = ${tableName}
  `.execute(db);
  const createTableSql = tableDefinition.rows.at(0)?.sql;
  assert.ok(createTableSql, `Expected SQLite table ${tableName} to exist`);
  const indexDefinitions = await sql<{
    sql: string | null;
  }>`
    select sql from sqlite_master
    where type = 'index' and tbl_name = ${tableName} and sql is not null
  `.execute(db);
  const replacementTableSql = transform(createTableSql);
  assert.notEqual(replacementTableSql, createTableSql);
  const backupTableName = `_node_gtfs_drift_${tableName}`;
  await sql
    .raw(`alter table "${tableName}" rename to "${backupTableName}"`)
    .execute(db);
  await sql.raw(replacementTableSql).execute(db);
  await sql.raw(`drop table "${backupTableName}"`).execute(db);
  for (const index of indexDefinitions.rows) {
    assert.ok(index.sql);
    await sql.raw(index.sql).execute(db);
  }
}
async function applySchemaDrift(
  db: Kysely<ConformanceDatabase>,
  dialect: GtfsDatabaseDialect,
  kind: SchemaDriftKind,
): Promise<void> {
  if (kind === 'missing-storage-key' || kind === 'wrong-storage-key') {
    if (dialect === 'sqlite') {
      await rebuildSqliteTable(db, 'routes', (statement) =>
        replaceSqlPattern(
          statement,
          /,\s*(?:constraint "[^"]+"\s+)?primary key\s*\("source_id",\s*"route_id"\)/iu,
          kind === 'missing-storage-key'
            ? ''
            : ', PRIMARY KEY ("source_id", "route_id", "agency_id")',
        ),
      );
    } else {
      await sql
        .raw(
          dialect === 'mysql'
            ? 'alter table routes drop index unique_routes_storage_key'
            : 'alter table routes drop constraint primary_routes',
        )
        .execute(db);
      if (kind === 'wrong-storage-key') {
        await sql
          .raw(
            dialect === 'mysql'
              ? 'alter table routes add constraint unique_routes_storage_key unique (_node_gtfs_storage_key, route_type)'
              : 'alter table routes add constraint primary_routes primary key (source_id, route_id, route_type)',
          )
          .execute(db);
      }
    }
    return;
  }
  if (kind === 'wrong-index-columns' || kind === 'wrong-index-order') {
    await applySchemaDrift(db, dialect, 'missing-index');
    const column =
      kind === 'wrong-index-columns' ? 'from_stop_id' : 'to_stop_id';
    await sql
      .raw(
        `create index idx_transfers_to_stop_id on transfers (${column}${dialect === 'mysql' ? '(191)' : ''}${kind === 'wrong-index-order' ? ' desc' : ''})`,
      )
      .execute(db);
    return;
  }
  if (kind === 'wrong-default') {
    if (dialect === 'sqlite') {
      await rebuildSqliteTable(db, 'transfers', (statement) =>
        replaceSqlPattern(statement, /\bdefault 0/iu, 'DEFAULT 1'),
      );
    } else {
      await sql
        .raw('alter table transfers alter column transfer_type set default 1')
        .execute(db);
    }
    return;
  }
  if (kind === 'wrong-generated-expression') {
    if (dialect === 'sqlite') {
      await rebuildSqliteTable(db, 'stop_times', (statement) => {
        const expression =
          /"departure_service_day_seconds" integer generated always as \([\s\S]*?end\s+\) stored/iu;
        return expression.test(statement)
          ? replaceSqlPattern(
              statement,
              expression,
              '"departure_service_day_seconds" INTEGER GENERATED ALWAYS AS (1) STORED',
            )
          : replaceSqlPattern(
              statement,
              /"departure_service_day_seconds" integer/iu,
              '"departure_service_day_seconds" INTEGER GENERATED ALWAYS AS (1) STORED',
            );
      });
    } else {
      await applySchemaDrift(db, dialect, 'incompatible-generated-column');
    }
    return;
  }
  if (kind === 'missing-column') {
    await sql.raw('alter table agency drop column agency_url').execute(db);
    return;
  }
  if (kind === 'missing-index') {
    await sql
      .raw(
        dialect === 'mysql'
          ? 'drop index idx_transfers_to_stop_id on transfers'
          : 'drop index idx_transfers_to_stop_id',
      )
      .execute(db);
    return;
  }
  if (dialect === 'sqlite') {
    if (kind === 'wrong-nullability') {
      await rebuildSqliteTable(db, 'agency', (statement) =>
        replaceSqlPattern(
          statement,
          /"agency_name" text\s+(?:collate binary\s+not null|not null\s+collate binary)/iu,
          '"agency_name" text COLLATE BINARY',
        ),
      );
      return;
    }
    if (kind === 'missing-default') {
      await rebuildSqliteTable(db, 'transfers', (statement) =>
        replaceSqlPattern(statement, /\s+default 0/iu, ''),
      );
      return;
    }
    if (kind === 'incompatible-generated-column') {
      await rebuildSqliteTable(db, 'stop_times', (statement) => {
        const generatedColumn =
          /"departure_service_day_seconds" integer generated always as \([\s\S]*?end\s+\) stored/iu;
        return generatedColumn.test(statement)
          ? replaceSqlPattern(
              statement,
              generatedColumn,
              '"departure_service_day_seconds" INTEGER',
            )
          : replaceSqlPattern(
              statement,
              /"departure_service_day_seconds" integer/iu,
              '"departure_service_day_seconds" INTEGER GENERATED ALWAYS AS (0) STORED',
            );
      });
      return;
    }
    await rebuildSqliteTable(db, 'agency', (statement) =>
      replaceSqlPattern(
        statement,
        /"agency_name" text\s+(?:collate binary\s+not null|not null\s+collate binary)/iu,
        '"agency_name" integer not null',
      ),
    );
    return;
  }
  if (kind === 'incompatible-generated-column') {
    await sql
      .raw('alter table stop_times drop column departure_service_day_seconds')
      .execute(db);
    await sql
      .raw(
        'alter table stop_times add column departure_service_day_seconds integer generated always as (0) stored',
      )
      .execute(db);
    return;
  }
  if (dialect === 'postgres') {
    const statement =
      kind === 'wrong-nullability'
        ? 'alter table agency alter column agency_name drop not null'
        : kind === 'missing-default'
          ? 'alter table transfers alter column transfer_type drop default'
          : 'alter table agency alter column agency_name type integer using null::integer';
    await sql.raw(statement).execute(db);
    return;
  }
  const statement =
    kind === 'wrong-nullability'
      ? 'alter table agency modify column agency_name text null'
      : kind === 'missing-default'
        ? 'alter table transfers alter column transfer_type drop default'
        : 'alter table agency modify column agency_name integer not null';
  await sql.raw(statement).execute(db);
}
function expectOnlySchemaDrift(
  issue: GtfsTableSchemaIssue,
  kind: SchemaDriftKind,
): void {
  assert.ok(!issue.missingTable);
  if (kind !== 'missing-column') {
    assert.deepEqual(issue.missingColumns, []);
  }
  if (kind !== 'wrong-nullability') {
    assert.deepEqual(issue.unexpectedlyNullableColumns, []);
  }
  if (kind !== 'missing-default') {
    assert.deepEqual(issue.missingDefaultColumns, []);
  }
  if (kind !== 'missing-index') {
    assert.deepEqual(issue.missingIndexes, []);
  }
  if (kind !== 'unexpected-column-type') {
    assert.deepEqual(issue.incompatibleColumnTypes, []);
  }
  if (
    kind !== 'incompatible-generated-column' &&
    kind !== 'wrong-generated-expression'
  ) {
    assert.deepEqual(issue.incompatibleGeneratedColumns, []);
  }
}
export async function verifySchemaDriftMatrix(
  db: Kysely<ConformanceDatabase>,
  dialect: GtfsDatabaseDialect,
  lifecycle: Readonly<{
    recreate: () => Promise<void> | void;
    inspect: () => Promise<GtfsSchemaInspection> | GtfsSchemaInspection;
  }> = {
    recreate: async () => {
      await createKyselyGtfsTables({
        database: db,
        dialect,
        mode: 'recreate',
      });
      await createKyselyGtfsIndexes({ database: db, dialect, mode: 'ensure' });
    },
    inspect: () =>
      inspectKyselyGtfsSchema({
        database: db,
        dialect,
        includeIndexes: true,
      }),
  },
): Promise<void> {
  const gtfs = new Gtfs({
    database: { client: db },
    reporting: { level: 'silent' },
  });
  const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-query-drift-'));
  const exportFeed = () =>
    gtfs.export({
      outputDirectory: path.join(directory, 'export'),
      overwrite: true,
    });
  try {
    for (const driftCase of schemaDriftCases) {
      try {
        await lifecycle.recreate();
        await sql`insert into agency (source_id, agency_name, agency_url, agency_timezone, _node_gtfs_key)
        values ('query-drift', 'Query drift', 'https://example.com', 'Etc/UTC', ${'0'.repeat(64)})`.execute(
          db,
        );
        const repositories: Record<string, TestRepository> = {
          agency: gtfs.schedule.agency,
          routes: gtfs.schedule.routes,
          transfers: gtfs.schedule.transfers,
          stop_times: gtfs.schedule.stopTimes,
        };
        const repository = repositories[driftCase.tableName];
        assert.ok(repository);
        await repository.all();
        await exportFeed();
        if (driftCase.tableName === 'agency') {
          await sql`delete from agency`.execute(db);
        }
        await applySchemaDrift(db, dialect, driftCase.kind);
        const inspection = await lifecycle.inspect();
        assert.ok(!inspection.compatible);
        assert.deepEqual(
          inspection.tableIssues.map(({ tableName }) => tableName),
          [driftCase.tableName],
        );
        const issue = inspection.tableIssues.at(0);
        assert.ok(issue);
        expectOnlySchemaDrift(issue, driftCase.kind);
        driftCase.verify(issue);
        const unreadable = [
          'missing-column',
          'wrong-nullability',
          'unexpected-column-type',
        ].includes(driftCase.kind);
        if (unreadable) {
          let repositoryDetails: unknown;
          for (const read of [
            () => repository.all(),
            () => repository.first(),
            () => repository.count(),
            exportFeed,
          ]) {
            await assert.rejects(
              async () => (typeof read === 'function' ? read() : read),
              (error: unknown) => {
                assert.ok(isGtfsError(error));
                assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
                if (repositoryDetails === undefined) {
                  repositoryDetails = error.details;
                }
                assert.deepEqual(error.details, repositoryDetails);
                return true;
              },
            );
          }
        } else {
          assert.deepEqual(await repository.all(), []);
          assert.equal(await repository.first(), null);
          assert.equal(await repository.count(), 0);
          await exportFeed();
        }
      } catch (cause) {
        throw new Error(
          `${dialect} schema drift case ${JSON.stringify(driftCase.name)} failed`,
          { cause },
        );
      }
    }
  } finally {
    await gtfs.close();
    await rm(directory, { recursive: true, force: true });
  }
}
