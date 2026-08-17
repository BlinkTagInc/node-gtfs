import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import assert from 'node:assert';

import mysql from 'mysql2';
import pg from 'pg';
import { Kysely, MysqlDialect, PostgresDialect } from 'kysely';

import { importGtfsToKysely } from '../../dist/index.js';
import type { KyselyImportDialect } from '../../dist/index.js';
import { inspectKyselyGtfsSchema } from '../lib/kysely-schema-inspector.ts';
import { describe, expect, it } from './test-utils.ts';

interface ConformanceDatabase {
  agency: {
    agency_id: string | null;
    agency_name: string;
    agency_url: string;
    agency_timezone: string;
  };
  stop_times: {
    trip_id: string;
    arrival_time: string | null;
    arrival_timestamp: number | null;
    stop_id: string | null;
    stop_sequence: number;
  };
}

async function verifyDatabase(
  db: Kysely<ConformanceDatabase>,
  dialect: KyselyImportDialect,
): Promise<void> {
  const fixturePath = mkdtempSync(path.join(tmpdir(), `gtfs-${dialect}-`));

  try {
    await writeFile(
      path.join(fixturePath, 'agency.txt'),
      [
        'agency_id,agency_name,agency_url,agency_timezone',
        'agency-ü,Example Transit,https://example.com,America/Los_Angeles',
        ',No ID One,https://one.example.com,Etc/UTC',
        ',No ID Two,https://two.example.com,Etc/UTC',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(fixturePath, 'stop_times.txt'),
      [
        'trip_id,arrival_time,stop_id,stop_sequence',
        `${'long-trip-'.repeat(30)},9:05:01,stop-1,1`,
        `${'long-trip-'.repeat(30)},9:05:01,stop-1,1`,
        '',
      ].join('\n'),
    );

    await importGtfsToKysely(
      {
        agencies: [{ path: fixturePath, prefix: 'feed-' }],
        ignoreDuplicates: true,
        logLevel: 'silent',
      },
      { db, dialect },
    );

    const agency = await db
      .selectFrom('agency')
      .select(['agency_id', 'agency_name', 'agency_url', 'agency_timezone'])
      .where('agency_id', '=', 'feed-agency-ü')
      .executeTakeFirstOrThrow();
    expect(agency).toEqual({
      agency_id: 'feed-agency-ü',
      agency_name: 'Example Transit',
      agency_url: 'https://example.com',
      agency_timezone: 'America/Los_Angeles',
    });

    const agenciesWithoutIds = await db
      .selectFrom('agency')
      .select('agency_name')
      .where('agency_id', 'is', null)
      .orderBy('agency_name')
      .execute();
    expect(agenciesWithoutIds).toEqual([
      { agency_name: 'No ID One' },
      { agency_name: 'No ID Two' },
    ]);

    const stopTime = await db
      .selectFrom('stop_times')
      .select([
        'trip_id',
        'arrival_time',
        'arrival_timestamp',
        'stop_id',
        'stop_sequence',
      ])
      .executeTakeFirstOrThrow();
    expect(stopTime).toEqual({
      trip_id: `feed-${'long-trip-'.repeat(30)}`,
      arrival_time: '09:05:01',
      arrival_timestamp: 32_701,
      stop_id: 'feed-stop-1',
      stop_sequence: 1,
    });

    const inspection = await inspectKyselyGtfsSchema(db, {
      includeNodeGtfsExtras: true,
    });
    expect(inspection.compatible).toBeTruthy();

    await db.deleteFrom('stop_times').execute();
    await assert.rejects(
      importGtfsToKysely(
        {
          agencies: [{ path: fixturePath, exclude: ['agency'] }],
          logLevel: 'silent',
        },
        {
          db,
          dialect,
          manageSchema: false,
          includeNodeGtfsExtras: true,
        },
      ),
    );
    const { count } = await db
      .selectFrom('stop_times')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();
    expect(Number(count)).toBe(0);
  } finally {
    await rm(fixturePath, { recursive: true, force: true });
  }
}

const postgresUrl = process.env.GTFS_TEST_POSTGRES_URL;
describe(
  'PostgreSQL writer integration',
  { skip: postgresUrl === undefined },
  () => {
    it('passes the managed-schema conformance checks', async () => {
      const db = new Kysely<ConformanceDatabase>({
        dialect: new PostgresDialect({
          pool: new pg.Pool({ connectionString: postgresUrl }),
        }),
      });
      try {
        await verifyDatabase(db, 'postgres');
      } finally {
        await db.destroy();
      }
    });
  },
);

const mysqlUrl = process.env.GTFS_TEST_MYSQL_URL;
describe('MySQL writer integration', { skip: mysqlUrl === undefined }, () => {
  it('passes the managed-schema conformance checks', async () => {
    const db = new Kysely<ConformanceDatabase>({
      dialect: new MysqlDialect({
        pool: mysql.createPool(mysqlUrl ?? ''),
      }),
    });
    try {
      await verifyDatabase(db, 'mysql');
    } finally {
      await db.destroy();
    }
  });
});
