import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import {
  Kysely,
  MysqlDialect,
  PostgresDialect,
  SqliteDialect,
  sql,
  type MysqlPoolConnection,
  type PostgresPoolClient,
} from 'kysely';

import { describe, it } from 'node:test';
import { compilePortableWrites } from '../helpers/portable-write-compilation.ts';
import { inspectKyselyGtfsSchema } from '../../src/kysely.ts';
import { GtfsErrorCode, importGtfs } from '../../src/index.ts';

interface TestDatabase {
  agency: {
    source_id: string;
    agency_id: string | null;
    agency_name: string;
    agency_url: string;
    agency_timezone: string;
    agency_lang: string | null;
    agency_phone: string | null;
    agency_fare_url: string | null;
    agency_email: string | null;
    cemv_support: number | null;
  };
  stop_times: {
    source_id: string;
    trip_id: string;
    arrival_time: string | null;
    arrival_service_day_seconds: number | null;
    stop_id: string | null;
    stop_sequence: number;
  };
  stops: {
    source_id: string;
    stop_id: string;
    stop_name: string;
  };
}

function importPortable(
  db: Kysely<TestDatabase>,
  dialect: 'mysql' | 'postgres' | 'sqlite',
  fixturePath: string,
  options: {
    onDuplicateKey?: 'reject' | 'keep-first';
    onExistingData?: 'replace-source' | 'reject';
  } = {},
) {
  return importGtfs({
    database: { client: db },
    sources: [
      {
        sourceId: 'test',
        schedule: {
          path: fixturePath,
          import: {
            ...(options.onExistingData === undefined
              ? {}
              : { onExistingData: options.onExistingData }),
            validation: {
              mode: 'permissive',
              onUnknownField: 'discard',
              ...(options.onDuplicateKey === undefined
                ? {}
                : { onDuplicateKey: options.onDuplicateKey }),
            },
          },
        },
      },
    ],
    reporting: { level: 'silent' },
  });
}

describe('importGtfs() with Kysely:', () => {
  it('imports normalized rows without taking ownership of the Kysely instance', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-kysely-'));
    const sqlite = new Database(':memory:');
    const db = new Kysely<TestDatabase>({
      dialect: new SqliteDialect({ database: sqlite }),
    });

    try {
      await writeFile(
        path.join(fixturePath, 'stop_times.txt'),
        [
          'trip_id,arrival_time,stop_id,stop_sequence',
          'trip-1,9:05:01,stop-1,1',
          '',
        ].join('\n'),
      );

      await importGtfs({
        database: { client: db },
        sources: [
          {
            sourceId: 'kysely',
            schedule: {
              path: fixturePath,
              import: {
                validation: {
                  mode: 'permissive',
                  onUnknownField: 'discard',
                },
              },
            },
          },
        ],
        reporting: { level: 'silent' },
      });

      const row = await db
        .selectFrom('stop_times')
        .select([
          'trip_id',
          'source_id',
          'arrival_time',
          'arrival_service_day_seconds',
          'stop_id',
          'stop_sequence',
        ])
        .executeTakeFirstOrThrow();

      assert.deepEqual(row, {
        source_id: 'kysely',
        trip_id: 'trip-1',
        arrival_time: '09:05:01',
        arrival_service_day_seconds: 32_701,
        stop_id: 'stop-1',
        stop_sequence: 1,
      });

      const inspection = await inspectKyselyGtfsSchema({
        database: db,
        dialect: 'sqlite',
      });
      assert.deepEqual(inspection, { compatible: true, tableIssues: [] });

      const { count } = await db
        .selectFrom('stop_times')
        .select((expression) => expression.fn.countAll<number>().as('count'))
        .executeTakeFirstOrThrow();
      assert.deepEqual(count, 1);
    } finally {
      await db.destroy();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('rejects an application-managed schema missing generated columns without altering it', async () => {
    const fixturePath = mkdtempSync(
      path.join(tmpdir(), 'gtfs-kysely-managed-'),
    );
    const sqlite = new Database(':memory:');
    const db = new Kysely<TestDatabase>({
      dialect: new SqliteDialect({ database: sqlite }),
    });

    try {
      await db.schema
        .createTable('agency')
        .addColumn('source_id', 'text', (column) => column.notNull())
        .addColumn('agency_id', 'text')
        .addColumn('agency_name', 'text', (column) => column.notNull())
        .addColumn('agency_url', 'text', (column) => column.notNull())
        .addColumn('agency_timezone', 'text', (column) => column.notNull())
        .addColumn('agency_lang', 'text')
        .addColumn('agency_phone', 'text')
        .addColumn('agency_fare_url', 'text')
        .addColumn('agency_email', 'text')
        .addColumn('cemv_support', 'integer')
        .execute();

      await writeFile(
        path.join(fixturePath, 'agency.txt'),
        [
          'agency_id,agency_name,agency_url,agency_timezone',
          'agency-1,Example Transit,https://example.com,America/Los_Angeles',
          '',
        ].join('\n'),
      );
      const before = sqlite.prepare('PRAGMA table_xinfo(agency)').all();
      await assert.rejects(importPortable(db, 'sqlite', fixturePath), {
        code: GtfsErrorCode.SCHEMA_INVALID,
      });
      assert.deepEqual(
        sqlite.prepare('PRAGMA table_xinfo(agency)').all(),
        before,
      );
      assert.deepEqual(await db.selectFrom('agency').selectAll().execute(), []);
      const inspection = await inspectKyselyGtfsSchema({
        database: db,
        dialect: 'sqlite',
      });
      const agencyIssue = inspection.tableIssues.find(
        ({ tableName }) => tableName === 'agency',
      );
      assert.ok(
        agencyIssue?.missingColumns.includes('_node_gtfs_casefold_agency_name'),
      );
      assert.ok(agencyIssue?.missingColumns.includes('_node_gtfs_key'));
    } finally {
      await db.destroy();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('replaces an existing source through the portable writer by default', async () => {
    const fixturePath = mkdtempSync(
      path.join(tmpdir(), 'gtfs-kysely-duplicates-'),
    );
    const sqlite = new Database(':memory:');
    const db = new Kysely<TestDatabase>({
      dialect: new SqliteDialect({ database: sqlite }),
    });

    try {
      const agencyPath = path.join(fixturePath, 'agency.txt');
      await writeFile(
        agencyPath,
        [
          'agency_id,agency_name,agency_url,agency_timezone',
          'agency-1,First Agency,https://example.com,Etc/UTC',
          '',
        ].join('\n'),
      );
      await importPortable(db, 'sqlite', fixturePath);

      await writeFile(
        agencyPath,
        [
          'agency_id,agency_name,agency_url,agency_timezone',
          'agency-1,Replacement Agency,https://example.com,Etc/UTC',
          '',
        ].join('\n'),
      );
      await importPortable(db, 'sqlite', fixturePath);

      const agency = await db
        .selectFrom('agency')
        .select('agency_name')
        .executeTakeFirstOrThrow();
      assert.deepEqual(agency.agency_name, 'Replacement Agency');
    } finally {
      await db.destroy();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('rejects an existing source through the portable writer', async () => {
    const fixturePath = mkdtempSync(
      path.join(tmpdir(), 'gtfs-kysely-existing-source-'),
    );
    const sqlite = new Database(':memory:');
    const db = new Kysely<TestDatabase>({
      dialect: new SqliteDialect({ database: sqlite }),
    });

    try {
      const agencyPath = path.join(fixturePath, 'agency.txt');
      await writeFile(
        agencyPath,
        [
          'agency_id,agency_name,agency_url,agency_timezone',
          'agency-1,First Agency,https://example.com,Etc/UTC',
          '',
        ].join('\n'),
      );
      await importPortable(db, 'sqlite', fixturePath);

      await writeFile(
        agencyPath,
        [
          'agency_id,agency_name,agency_url,agency_timezone',
          'agency-1,Replacement Agency,https://example.com,Etc/UTC',
          '',
        ].join('\n'),
      );
      await assert.rejects(
        importPortable(db, 'sqlite', fixturePath, { onExistingData: 'reject' }),
        (error: unknown) => {
          assert.equal(
            (error as { code?: unknown }).code,
            GtfsErrorCode.DATABASE_SOURCE_EXISTS,
          );
          assert.equal(
            (error as { details?: { sourceId?: unknown } }).details?.sourceId,
            'test',
          );
          return true;
        },
      );

      const agency = await db
        .selectFrom('agency')
        .select('agency_name')
        .executeTakeFirstOrThrow();
      assert.deepEqual(agency.agency_name, 'First Agency');
    } finally {
      await db.destroy();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('restores an existing source when portable replacement writing fails', async () => {
    const fixturePath = mkdtempSync(
      path.join(tmpdir(), 'gtfs-kysely-atomic-source-'),
    );
    const sqlite = new Database(':memory:');
    const db = new Kysely<TestDatabase>({
      dialect: new SqliteDialect({ database: sqlite }),
    });
    const agencyPath = path.join(fixturePath, 'agency.txt');
    const stopsPath = path.join(fixturePath, 'stops.txt');

    try {
      await Promise.all([
        writeFile(
          agencyPath,
          [
            'agency_id,agency_name,agency_url,agency_timezone',
            'agency-1,First Agency,https://example.com,Etc/UTC',
            '',
          ].join('\n'),
        ),
        writeFile(
          stopsPath,
          [
            'stop_id,stop_name,stop_lat,stop_lon',
            'stop-1,First Stop,0,0',
            '',
          ].join('\n'),
        ),
      ]);
      await importPortable(db, 'sqlite', fixturePath);
      await sql`
        create trigger fail_portable_replacement_stop
        before insert on stops
        when new.source_id = 'test'
          and new.stop_name = 'Replacement Stop'
        begin
          select raise(abort, 'injected replacement failure');
        end
      `.execute(db);
      await Promise.all([
        writeFile(
          agencyPath,
          [
            'agency_id,agency_name,agency_url,agency_timezone',
            'agency-1,Replacement Agency,https://example.com,Etc/UTC',
            '',
          ].join('\n'),
        ),
        writeFile(
          stopsPath,
          [
            'stop_id,stop_name,stop_lat,stop_lon',
            'stop-1,Replacement Stop,0,0',
            '',
          ].join('\n'),
        ),
      ]);

      await assert.rejects(
        importPortable(db, 'sqlite', fixturePath),
        (error: unknown) =>
          (error as { code?: unknown }).code ===
          GtfsErrorCode.DATABASE_OPERATION_FAILED,
      );
      assert.deepEqual(
        await db.selectFrom('agency').select('agency_name').execute(),
        [{ agency_name: 'First Agency' }],
      );
      assert.deepEqual(
        await db.selectFrom('stops').select('stop_name').execute(),
        [{ stop_name: 'First Stop' }],
      );
    } finally {
      await db.destroy();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('compiles managed schema, indexes, and duplicate-safe inserts for MySQL', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-kysely-mysql-'));
    const queries: string[] = [];
    const connection = {
      config: {},
      threadId: 1,
      connect(callback?: (error: unknown) => void) {
        callback?.(undefined);
      },
      destroy() {},
      release() {},
      query(
        statement: string,
        _parameters: unknown,
        callback?: (error: unknown, result: unknown) => void,
      ) {
        queries.push(statement);
        callback?.(undefined, {
          affectedRows: 1,
          changedRows: 0,
          insertId: 0,
        });
        return {
          stream: () => ({
            async *[Symbol.asyncIterator]() {},
          }),
        };
      },
    } as MysqlPoolConnection;
    const db = new Kysely<TestDatabase>({
      dialect: new MysqlDialect({
        pool: {
          getConnection(callback) {
            callback(undefined, connection);
          },
          end(callback) {
            callback(undefined);
          },
        },
      }),
    });

    try {
      await writeFile(
        path.join(fixturePath, 'agency.txt'),
        [
          'agency_id,agency_name,agency_url,agency_timezone',
          'agency-1,Example Transit,https://example.com,America/Los_Angeles',
          '',
        ].join('\n'),
      );
      await writeFile(
        path.join(fixturePath, 'routes.txt'),
        ['route_id,route_short_name,route_type', 'route-1,One,3', ''].join(
          '\n',
        ),
      );

      await compilePortableWrites({
        database: db,
        dialect: 'mysql',
        directory: fixturePath,
        onDuplicateKey: 'keep-first',
      });

      assert.ok(
        queries.some(
          (query) =>
            query.startsWith('create table `agency`') &&
            query.includes('`_node_gtfs_key` varchar(64) not null') &&
            query.includes('text collate utf8mb4_0900_bin') &&
            query.includes('`_node_gtfs_casefold_agency_name`'),
        ),
      );
      assert.ok(
        queries.some(
          (query) =>
            query.startsWith('create table `routes`') &&
            query.includes('`_node_gtfs_storage_key` varchar(64)'),
        ),
      );
      assert.ok(
        queries.some(
          (query) =>
            query.startsWith('create table `fare_attributes`') &&
            query.includes('`price` bigint'),
        ),
      );
      assert.ok(
        queries.some(
          (query) =>
            query.startsWith('create table `fare_rules`') &&
            query.includes('`_node_gtfs_key` varchar(64) not null') &&
            query.includes('unique (`_node_gtfs_key`)') &&
            !query.includes('`_node_gtfs_storage_key`'),
        ),
      );
      assert.ok(
        queries.some(
          (query) =>
            query.startsWith('insert into `agency`') &&
            query.includes('`_node_gtfs_key`') &&
            query.includes('`_node_gtfs_casefold_agency_name`') &&
            !query.includes('on duplicate key update') &&
            !query.startsWith('insert ignore'),
        ),
      );
      assert.ok(
        queries.some(
          (query) =>
            query.startsWith('insert into `routes`') &&
            query.includes('`_node_gtfs_storage_key`'),
        ),
      );
      assert.ok(
        queries.some(
          (query) =>
            query.startsWith('create index') && query.includes('(191)'),
        ),
      );

      queries.length = 0;
      await compilePortableWrites({
        database: db,
        dialect: 'mysql',
        directory: fixturePath,
      });

      assert.ok(
        queries.some(
          (query) =>
            query.startsWith('insert into `routes`') &&
            query.includes('`_node_gtfs_storage_key`'),
        ),
      );
    } finally {
      await db.destroy();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('compiles PostgreSQL time indexes with their generated columns', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-kysely-plain-'));
    const queries: string[] = [];
    const connection = {
      processID: 1,
      async query(statement: string) {
        queries.push(statement);
        return { command: 'SELECT' as const, rowCount: 0, rows: [] };
      },
      release() {},
    } as unknown as PostgresPoolClient;
    const db = new Kysely<TestDatabase>({
      dialect: new PostgresDialect({
        pool: {
          options: {},
          async connect() {
            return connection;
          },
          async end() {},
        },
      }),
    });

    try {
      await writeFile(
        path.join(fixturePath, 'agency.txt'),
        [
          'agency_id,agency_name,agency_url,agency_timezone',
          'agency-1,Example Transit,https://example.com,America/Los_Angeles',
          '',
        ].join('\n'),
      );

      await compilePortableWrites({
        database: db,
        dialect: 'postgres',
        directory: fixturePath,
      });

      const stopTimeIndexes = queries.filter(
        (query) =>
          query.startsWith('create index') && query.includes('"stop_times"'),
      );

      assert.ok(
        stopTimeIndexes.some((query) =>
          query.includes('("stop_id", "arrival_service_day_seconds")'),
        ),
      );
    } finally {
      await db.destroy();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('compiles managed schema and conflict handling for PostgreSQL', async () => {
    const fixturePath = mkdtempSync(
      path.join(tmpdir(), 'gtfs-kysely-postgres-'),
    );
    const queries: string[] = [];
    const connection = {
      processID: 1,
      async query(statement: string) {
        queries.push(statement);
        return { command: 'SELECT' as const, rowCount: 0, rows: [] };
      },
      release() {},
    } as unknown as PostgresPoolClient;
    const db = new Kysely<TestDatabase>({
      dialect: new PostgresDialect({
        pool: {
          options: {},
          async connect() {
            return connection;
          },
          async end() {},
        },
      }),
    });

    try {
      await writeFile(
        path.join(fixturePath, 'agency.txt'),
        [
          'agency_id,agency_name,agency_url,agency_timezone',
          'agency-1,Example Transit,https://example.com,America/Los_Angeles',
          '',
        ].join('\n'),
      );

      await compilePortableWrites({
        database: db,
        dialect: 'postgres',
        directory: fixturePath,
        onDuplicateKey: 'keep-first',
      });

      assert.ok(
        queries.some(
          (query) =>
            query.startsWith('create table "agency"') &&
            query.includes('text collate "C"') &&
            query.includes('"_node_gtfs_casefold_agency_name"'),
        ),
      );
      assert.ok(
        queries.some(
          (query) =>
            query.startsWith('create table "fare_attributes"') &&
            query.includes('"price" bigint'),
        ),
      );
      assert.ok(
        queries.some(
          (query) =>
            query.startsWith('create table "fare_rules"') &&
            query.includes('"_node_gtfs_key" varchar(64) not null') &&
            query.includes('unique ("_node_gtfs_key")'),
        ),
      );
      assert.ok(
        queries.every(
          (query) =>
            !query.toLowerCase().includes('foreign key') &&
            !query.toLowerCase().includes(' references '),
        ),
      );
      assert.ok(
        queries.some(
          (query) =>
            query.startsWith('insert into "agency"') &&
            query.endsWith('on conflict do nothing'),
        ),
      );
    } finally {
      await db.destroy();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });
});
