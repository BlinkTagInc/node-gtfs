import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Gtfs } from '../../src/instance.ts';
import { GtfsErrorCode, isGtfsError } from '../../src/diagnostics/errors.ts';
import { createSqliteGtfsTables } from '../../src/database/sqlite/schema-writer.ts';
import { readKyselyPhysicalSchemaMetadata } from '../../src/database/kysely/schema-inspector.ts';
import { validateGtfsQuerySchema } from '../../src/database/query-schema.ts';
import type { GtfsDynamicDatabase } from '../../src/database/clients.ts';
import { createValidatedExportContext } from '../../src/schedule/export/export.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
test('read preflight shares one metadata scan without inspecting indexes or requiring unused generated columns', async () => {
  const sqlite = new Database(':memory:');
  createSqliteGtfsTables({
    database: sqlite,
  });
  sqlite.exec(
    'ALTER TABLE routes DROP COLUMN _node_gtfs_casefold_route_short_name; ALTER TABLE routes DROP COLUMN _unknown_fields',
  );
  const queries: string[] = [];
  const database = new Kysely<GtfsDynamicDatabase>({
    dialect: new SqliteDialect({ database: sqlite }),
    log(event) {
      queries.push(event.query.sql);
    },
  });
  const gtfs = new Gtfs({
    database: { client: database },
    reporting: { level: 'silent' },
  });
  try {
    const context = await createValidatedExportContext({
      connection: {
        database,
        dialect: 'sqlite',
        databaseDescription: ':memory:',
      },
      enabledTables: [compiledTableRegistry.routes],
    });
    assert.equal(queries.length, 1);
    assert.ok(context.physicalColumns.get('routes')?.has('route_id'));
    assert.equal(
      context.physicalColumns.get('routes')?.has('_unknown_fields'),
      false,
    );
    queries.length = 0;
    assert.deepEqual(await gtfs.schedule.routes.all(), []);
    assert.equal(queries.length, 2);
    assert.ok(
      queries.every(
        (query) =>
          !/pragma_index|information_schema.statistics|pg_index/iu.test(query),
      ),
    );
    assert.equal(await gtfs.schedule.routes.first(), null);
    assert.equal(await gtfs.schedule.routes.count(), 0);
    sqlite.exec('DROP TABLE routes');
    let repositoryDetails: unknown;
    await assert.rejects(
      async () => gtfs.schedule.routes.all(),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
        repositoryDetails = error.details;
        return true;
      },
    );
    await assert.rejects(
      async () =>
        createValidatedExportContext({
          connection: context,
          enabledTables: [compiledTableRegistry.routes],
        }),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
        assert.deepEqual(error.details, repositoryDetails);
        return true;
      },
    );
  } finally {
    await gtfs.close();
    await database.destroy();
  }
});
test('read preflight deduplicates requested tables and refreshes optional-column metadata', async () => {
  const sqlite = new Database(':memory:');
  createSqliteGtfsTables({
    database: sqlite,
  });
  sqlite.exec('ALTER TABLE routes DROP COLUMN _unknown_fields');
  const database = new Kysely({
    dialect: new SqliteDialect({ database: sqlite }),
  });
  const options = {
    database,
    dialect: 'sqlite' as const,
    tables: [compiledTableRegistry.routes, compiledTableRegistry.routes],
  };
  try {
    assert.equal(
      (await validateGtfsQuerySchema(options))
        .get('routes')
        ?.has('_unknown_fields'),
      false,
    );
    sqlite.exec('ALTER TABLE routes ADD COLUMN _unknown_fields TEXT');
    assert.equal(
      (await validateGtfsQuerySchema(options))
        .get('routes')
        ?.has('_unknown_fields'),
      true,
    );
    sqlite.exec('DROP TABLE routes');
    await assert.rejects(
      async () => validateGtfsQuerySchema(options),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        const inspection = error.details?.schema as {
          tableIssues: unknown[];
        };
        assert.equal(inspection.tableIssues.length, 1);
        return true;
      },
    );
  } finally {
    await database.destroy();
  }
});

test('scoped SQLite metadata keeps all table names and exact columns only for requested tables', async () => {
  const sqlite = new Database(':memory:');
  createSqliteGtfsTables({ database: sqlite });
  const unusualName = "custom'); DROP TABLE routes; --";
  sqlite.exec(`CREATE TABLE "${unusualName}" (value TEXT)`);
  const database = new Kysely({
    dialect: new SqliteDialect({ database: sqlite }),
  });
  try {
    const options = { includeIndexes: false, includeColumnExpressions: false };
    const full = await readKyselyPhysicalSchemaMetadata(
      database,
      'sqlite',
      options,
    );
    for (const names of [['routes', 'trips'], [unusualName], [], ['absent']]) {
      const scoped = await readKyselyPhysicalSchemaMetadata(
        database,
        'sqlite',
        {
          ...options,
          columnTableNames: names,
        },
      );
      assert.deepEqual(
        scoped.tables,
        full.tables.map((table) => ({
          ...table,
          columns: names.includes(table.name) ? table.columns : [],
        })),
      );
      assert.deepEqual(scoped.indexes, []);
    }
  } finally {
    await database.destroy();
  }
});

test('scoped preflight still detects related-table drift and newly added conflicting TODS tables', async () => {
  const sqlite = new Database(':memory:');
  createSqliteGtfsTables({ database: sqlite, extensions: ['tods'] });
  const gtfs = new Gtfs({
    database: { client: sqlite },
    extensions: ['tods'],
    reporting: { level: 'silent' },
  });
  try {
    const query = async () =>
      gtfs.query.stopsForRoute({ routeId: 'red' }).all();
    assert.deepEqual(await query(), []);
    sqlite.exec('ALTER TABLE trips DROP COLUMN route_id');
    await assert.rejects(query, (error: unknown) => {
      assert.ok(isGtfsError(error));
      assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
      assert.match(JSON.stringify(error.details), /route_id/);
      return true;
    });
    assert.deepEqual(await gtfs.tods.vehicleAssignments.all(), []);
    sqlite.exec('CREATE TABLE deadheads (id TEXT)');
    await assert.rejects(
      async () => gtfs.tods.vehicleAssignments.all(),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
        assert.equal(error.details?.conflictingExtension, 'tods-v1');
        assert.deepEqual(error.details?.conflictingTables, ['deadheads']);
        return true;
      },
    );
    sqlite.exec('DROP TABLE deadheads');
    assert.deepEqual(await gtfs.tods.vehicleAssignments.all(), []);
  } finally {
    await gtfs.close();
    sqlite.close();
  }
});
