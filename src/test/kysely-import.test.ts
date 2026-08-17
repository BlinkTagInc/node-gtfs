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
  type MysqlPoolConnection,
  type PostgresPoolClient,
} from 'kysely';

import { describe, expect, it } from './test-utils.ts';
import { importGtfsToKysely } from '../../dist/index.js';
import { inspectKyselyGtfsSchema } from '../lib/kysely-schema-inspector.ts';

interface TestDatabase {
  agency: {
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
    trip_id: string;
    arrival_time: string | null;
    arrival_timestamp: number | null;
    stop_id: string | null;
    stop_sequence: number;
  };
}

describe('importGtfsToKysely():', () => {
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

      await importGtfsToKysely(
        {
          agencies: [{ path: fixturePath, prefix: 'feed-' }],
          logLevel: 'silent',
        },
        { db, dialect: 'sqlite' },
      );

      const row = await db
        .selectFrom('stop_times')
        .select([
          'trip_id',
          'arrival_time',
          'arrival_timestamp',
          'stop_id',
          'stop_sequence',
        ])
        .executeTakeFirstOrThrow();

      expect(row).toEqual({
        trip_id: 'feed-trip-1',
        arrival_time: '09:05:01',
        arrival_timestamp: 32_701,
        stop_id: 'feed-stop-1',
        stop_sequence: 1,
      });

      const inspection = await inspectKyselyGtfsSchema(db, {
        includeNodeGtfsExtras: true,
      });
      expect(inspection).toEqual({ compatible: true, tables: [] });

      const { count } = await db
        .selectFrom('stop_times')
        .select((expression) => expression.fn.countAll<number>().as('count'))
        .executeTakeFirstOrThrow();
      expect(count).toEqual(1);
    } finally {
      await db.destroy();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('can write to an application-managed schema without adding extra columns', async () => {
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

      await importGtfsToKysely(
        {
          agencies: [{ path: fixturePath }],
          logLevel: 'silent',
        },
        { db, dialect: 'sqlite', manageSchema: false },
      );

      const row = await db
        .selectFrom('agency')
        .select(['agency_id', 'agency_name', 'agency_url', 'agency_timezone'])
        .executeTakeFirstOrThrow();
      expect(row).toEqual({
        agency_id: 'agency-1',
        agency_name: 'Example Transit',
        agency_url: 'https://example.com',
        agency_timezone: 'America/Los_Angeles',
      });
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

      await importGtfsToKysely(
        {
          agencies: [{ path: fixturePath }],
          ignoreDuplicates: true,
          logLevel: 'silent',
        },
        { db, dialect: 'mysql' },
      );

      expect(
        queries.some(
          (query) =>
            query.startsWith('create table `agency`') &&
            query.includes('`_node_gtfs_primary_key` varchar(64)'),
        ),
      ).toBeTruthy();
      expect(
        queries.some(
          (query) =>
            query.startsWith('insert into `agency`') &&
            query.includes('`_node_gtfs_primary_key`') &&
            query.endsWith('on duplicate key update `agency_id` = `agency_id`'),
        ),
      ).toBeTruthy();
      expect(
        queries.some(
          (query) =>
            query.startsWith('create index') && query.includes('(191)'),
        ),
      ).toBeTruthy();
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

      await importGtfsToKysely(
        {
          agencies: [{ path: fixturePath }],
          ignoreDuplicates: true,
          logLevel: 'silent',
        },
        { db, dialect: 'postgres' },
      );

      expect(
        queries.some((query) => query.startsWith('create table "agency"')),
      ).toBeTruthy();
      expect(
        queries.some(
          (query) =>
            query.startsWith('insert into "agency"') &&
            query.endsWith('on conflict do nothing'),
        ),
      ).toBeTruthy();
    } finally {
      await db.destroy();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });
});
