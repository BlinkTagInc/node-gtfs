import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { recreateTestSchema } from '../../helpers/recreate-schema.ts';
import { verifyImportResultCounts } from './import-result.ts';
import { dropTodsTestTables } from './tods.ts';
import { Kysely, sql } from 'kysely';
import {
  exportGtfs,
  Gtfs,
  GtfsErrorCode,
  importGtfs,
} from '../../../src/index.ts';
import {
  cleanupGtfsRealtime,
  createKyselyGtfsTables,
  type GtfsDatabaseDialect,
  inspectKyselyGtfsSchema,
} from '../../../src/kysely.ts';
import { gtfsManifest } from '../../../src/schema/index.ts';
import {
  completeFixturePath,
  countFeedInventory,
} from '../../helpers/test-utils.ts';
import {
  portableKeyFixtures,
  writePortableKeyFixture,
} from '../../helpers/portable-key-fixture.ts';
import type { ConformanceDatabase } from './database-types.ts';

interface DatabaseConformanceContext {
  readonly db: Kysely<ConformanceDatabase>;
  readonly dialect: GtfsDatabaseDialect;
  readonly fixturePath: string;
}
async function prepareDatabaseConformanceFixture({
  db,
  fixturePath,
}: DatabaseConformanceContext): Promise<void> {
  await recreateTestSchema({
    database: { client: db },
    extensions: ['gtfs-realtime'],
  });
  await writeFile(
    path.join(fixturePath, 'agency.txt'),
    [
      'agency_id,agency_name,agency_url,agency_timezone',
      'agency-ü,Example Transit,https://example.com,America/Los_Angeles',
      ',No ID One,https://one.example.com,Etc/UTC',
      ',No ID Two,https://two.example.com,Etc/UTC',
      'case-A,Case A,https://a.example.com,Etc/UTC',
      'case-a,Case a,https://b.example.com,Etc/UTC',
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
  await writeFile(
    path.join(fixturePath, 'fare_attributes.txt'),
    [
      'fare_id,price,currency_type,payment_method,transfers',
      'exact-fare,92233720368547758.07,USD,0,0',
      '',
    ].join('\n'),
  );
  await writePortableKeyFixture(fixturePath);
  await importGtfs({
    database: { client: db },
    extensions: ['gtfs-realtime'],
    sources: [
      {
        sourceId: 'integration',
        schedule: {
          path: fixturePath,
          import: {
            validation: {
              mode: 'permissive',
              onUnknownField: 'discard',
              onDuplicateKey: 'keep-first',
            },
          },
        },
      },
    ],
    reporting: { level: 'silent' },
  });
}
async function verifyImportedAgencyIdentities({
  db,
}: DatabaseConformanceContext): Promise<void> {
  const agency = await db
    .selectFrom('agency')
    .select([
      'source_id',
      'agency_id',
      'agency_name',
      'agency_url',
      'agency_timezone',
    ])
    .where('agency_id', '=', 'agency-ü')
    .executeTakeFirstOrThrow();
  assert.deepEqual(agency, {
    source_id: 'integration',
    agency_id: 'agency-ü',
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
  assert.deepEqual(agenciesWithoutIds, [{ agency_name: 'No ID One' }]);
  const caseSensitiveIds = await db
    .selectFrom('agency')
    .select('agency_id')
    .where('agency_id', 'in', ['case-A', 'case-a'])
    .orderBy('agency_id')
    .execute();
  assert.deepEqual(caseSensitiveIds, [
    { agency_id: 'case-A' },
    { agency_id: 'case-a' },
  ]);
}
async function verifyNormalizedStorageValues({
  db,
  dialect,
}: DatabaseConformanceContext): Promise<void> {
  const storedFare = await db
    .selectFrom('fare_attributes')
    .select(
      sql<string>`cast(${sql.ref('price')} as ${sql.raw(dialect === 'postgres' ? 'text' : 'char')})`.as(
        'price',
      ),
    )
    .where('fare_id', '=', 'exact-fare')
    .executeTakeFirstOrThrow();
  assert.deepEqual(storedFare.price, '9223372036854775807');
  const foldedName = await (
    db as unknown as Kysely<Record<string, Record<string, string>>>
  )
    .selectFrom('agency')
    .select('_node_gtfs_casefold_agency_name')
    .where('agency_id', '=', 'agency-ü')
    .executeTakeFirstOrThrow();
  assert.deepEqual(
    foldedName._node_gtfs_casefold_agency_name,
    'example transit',
  );
  const stopTime = await db
    .selectFrom('stop_times')
    .select([
      'trip_id',
      'arrival_time',
      'arrival_service_day_seconds',
      'stop_id',
      'stop_sequence',
    ])
    .executeTakeFirstOrThrow();
  assert.deepEqual(stopTime, {
    trip_id: 'long-trip-'.repeat(30),
    arrival_time: '09:05:01',
    arrival_service_day_seconds: 32701,
    stop_id: 'stop-1',
    stop_sequence: 1,
  });
}
async function verifyRepositoryValueProjections({
  db,
}: DatabaseConformanceContext): Promise<void> {
  const gtfs = new Gtfs({
    database: { client: db },
    sources: [{ sourceId: 'integration' }],
    reporting: { level: 'silent' },
  });
  try {
    const portableStopTimes = await gtfs.schedule.stopTimes
      .where({ arrival_time: '09:05:01' })
      .select('trip_id', 'arrival_time', 'arrival_service_day_seconds')
      .orderBy([{ field: 'stop_sequence', direction: 'asc' }])
      .limit(1)
      .offset(0)
      .all();
    assert.deepEqual(portableStopTimes, [
      {
        trip_id: 'long-trip-'.repeat(30),
        arrival_time: '09:05:01',
        arrival_service_day_seconds: 32701,
      },
    ]);
    const portableNulls = await gtfs.schedule.agency
      .where({ agency_id: null })
      .select('agency_name')
      .orderBy([{ field: 'agency_name', direction: 'asc' }])
      .limit(1)
      .offset(0)
      .all();
    assert.deepEqual(portableNulls, [{ agency_name: 'No ID One' }]);
    const portableFare = await gtfs.schedule.fareAttributes
      .where({
        price: '92233720368547758.07',
        currency_type: 'USD',
      })
      .select('fare_id', 'price')
      .all();
    assert.deepEqual(portableFare, [
      { fare_id: 'exact-fare', price: '92233720368547758.07' },
    ]);
  } finally {
    await gtfs.close();
  }
}
async function verifyRealtimeExpirationBoundaries({
  db,
  dialect,
}: DatabaseConformanceContext): Promise<void> {
  await createKyselyGtfsTables({
    database: db,
    dialect,
    mode: 'ensure',
    extensions: ['gtfs-realtime'],
  });
  await sql`insert into alerts
    (source_id, realtime_feed_id, entity_id, header_text, description_text,
     created_at_unix_seconds, expires_at_unix_seconds)
    values
      ('expiration-clock', 'alerts', 'before', 'Before', 'Before', 1, 99),
      ('expiration-clock', 'alerts', 'boundary', 'Boundary', 'Boundary', 1, 100),
      ('expiration-clock', 'alerts', 'after', 'After', 'After', 1, 101)`.execute(
    db,
  );
  await sql`insert into realtime_snapshots
    (source_id, realtime_feed_id, snapshot_id, fetched_at_unix_seconds,
     entity_count, payload_sha256, raw_payload, raw_payload_encoding,
     retention_expires_at_unix_seconds)
    values
      ('expiration-clock', 'alerts', 'before', 1, 0, 'before', '', 'base64', 99),
      ('expiration-clock', 'alerts', 'boundary', 1, 0, 'boundary', '', 'base64', 100),
      ('expiration-clock', 'alerts', 'after', 1, 0, 'after', '', 'base64', 101)`.execute(
    db,
  );
  const cleanup = await cleanupGtfsRealtime({
    database: db,
    nowUnixSeconds: 100,
    extensions: ['gtfs-realtime'],
    sourceIds: ['expiration-clock'],
  });
  assert.deepEqual(cleanup.currentStateRowsDeleted, 2);
  assert.deepEqual(cleanup.snapshotHistoryRowsDeleted, 2);
  assert.deepEqual(
    (
      await sql<{
        entity_id: string;
      }>`select entity_id from alerts
        where source_id = 'expiration-clock'`.execute(db)
    ).rows,
    [{ entity_id: 'after' }],
  );
  assert.deepEqual(
    (
      await sql<{
        snapshot_id: string;
      }>`select snapshot_id
        from realtime_snapshots
        where source_id = 'expiration-clock'`.execute(db)
    ).rows,
    [{ snapshot_id: 'after' }],
  );
  assert.deepEqual(
    (
      await cleanupGtfsRealtime({
        database: db,
        nowUnixSeconds: 100,
        extensions: ['gtfs-realtime'],
        sourceIds: ['expiration-clock'],
      })
    ).totalRowsDeleted,
    0,
  );
}
async function verifyPortableKeysAndSchema({
  db,
  dialect,
}: DatabaseConformanceContext): Promise<void> {
  const dynamicDb = db as unknown as Kysely<
    Record<string, Record<string, unknown>>
  >;
  for (const { table } of portableKeyFixtures) {
    const { count } = await dynamicDb
      .selectFrom(table)
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();
    assert.deepEqual(Number(count), 1);
  }
  const inspection = await inspectKyselyGtfsSchema({
    database: db,
    dialect,
  });
  assert.ok(inspection.compatible);
}
async function verifySourceImportPolicies({
  db,
  fixturePath,
}: DatabaseConformanceContext): Promise<void> {
  const invalidPolicySource = path.join(fixturePath, 'policy-invalid');
  const validPolicySource = path.join(fixturePath, 'policy-valid');
  await Promise.all([mkdir(invalidPolicySource), mkdir(validPolicySource)]);
  await writeFile(
    path.join(validPolicySource, 'agency.txt'),
    [
      'agency_id,agency_name,agency_url,agency_timezone',
      'policy-agency,Policy Agency,https://example.com,Etc/UTC',
      '',
    ].join('\n'),
  );
  const policyResult = await importGtfs({
    database: { client: db },
    sources: [
      {
        sourceId: 'policy-invalid',
        schedule: {
          path: invalidPolicySource,
          import: {
            onSourceError: 'continue',
            validation: { mode: 'strict' },
          },
        },
      },
      {
        sourceId: 'policy-valid',
        schedule: {
          path: validPolicySource,
          import: {
            onSourceError: 'abort',
            validation: { mode: 'permissive' },
          },
        },
      },
    ],
    reporting: { level: 'silent' },
  });
  assert.deepEqual('errors' in policyResult && policyResult.errors.length, 1);
  assert.deepEqual(
    await db
      .selectFrom('agency')
      .select('agency_id')
      .where('source_id', '=', 'policy-valid')
      .execute(),
    [{ agency_id: 'policy-agency' }],
  );
  await writeFile(
    path.join(validPolicySource, 'agency.txt'),
    [
      'agency_id,agency_name,agency_url,agency_timezone',
      'policy-agency,Replacement Policy Agency,https://example.com,Etc/UTC',
      '',
    ].join('\n'),
  );
  await importGtfs({
    database: { client: db },
    sources: [
      {
        sourceId: 'policy-valid',
        schedule: {
          path: validPolicySource,
          import: { validation: { mode: 'permissive' } },
        },
      },
    ],
    reporting: { level: 'silent' },
  });
  assert.deepEqual(
    await db
      .selectFrom('agency')
      .select('agency_name')
      .where('source_id', '=', 'policy-valid')
      .executeTakeFirstOrThrow(),
    { agency_name: 'Replacement Policy Agency' },
  );
}
async function verifyExistingSourceRejection({
  db,
  fixturePath,
}: DatabaseConformanceContext): Promise<void> {
  await db.deleteFrom('stop_times').execute();
  await assert.rejects(
    async () =>
      importGtfs({
        database: { client: db },
        sources: [
          {
            sourceId: 'integration',
            schedule: {
              path: fixturePath,
              excludeFiles: ['agency.txt'],
              import: {
                onExistingData: 'reject',
                validation: {
                  mode: 'permissive',
                  onDuplicateKey: 'keep-first',
                },
              },
            },
          },
        ],
        reporting: { level: 'silent' },
      }),
    (error: unknown) =>
      (
        error as {
          code?: unknown;
        }
      ).code === GtfsErrorCode.DATABASE_SOURCE_EXISTS,
  );
  const { count } = await db
    .selectFrom('stop_times')
    .select((expression) => expression.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  assert.equal(Number(count), 0);
}
async function verifyCompleteScheduleExport({
  db,
  fixturePath,
}: DatabaseConformanceContext): Promise<void> {
  const completeExportPath = path.join(fixturePath, 'complete-export');
  await importGtfs({
    database: { client: db },
    sources: [
      {
        sourceId: 'complete',
        schedule: { path: completeFixturePath },
      },
    ],
    reporting: { level: 'silent' },
  });
  const result = await exportGtfs({
    database: { client: db },
    export: {
      outputDirectory: completeExportPath,
      sourceId: 'complete',
      batchSize: 2,
    },
    reporting: { level: 'silent' },
  });
  const sourceCounts = await countFeedInventory(
    completeFixturePath,
    gtfsManifest,
  );
  const exportedCounts = await countFeedInventory(
    completeExportPath,
    gtfsManifest,
  );
  assert.deepEqual(exportedCounts, sourceCounts);
  assert.equal(result.sourceId, 'complete');
  assert.equal(result.outputDirectory, path.resolve(completeExportPath));
  assert.deepEqual(
    Object.fromEntries(
      result.files.map(({ filename, recordCount }) => [filename, recordCount]),
    ),
    Object.fromEntries(
      Object.entries(gtfsManifest).flatMap(([tableName, table]) => {
        const recordCount = sourceCounts[tableName] ?? 0;
        return recordCount > 0 ? [[table.filename, recordCount]] : [];
      }),
    ),
  );
}
async function verifySourceLookupIndexes(
  db: Kysely<ConformanceDatabase>,
  dialect: GtfsDatabaseDialect,
): Promise<void> {
  if (dialect === 'mysql') {
    const { rows } = await sql<{
      table_name: string;
      index_name: string;
      sub_part: number | null;
    }>`
      select table_name as table_name, index_name as index_name, sub_part as sub_part from information_schema.statistics
      where table_schema = database() and column_name = 'source_id' and seq_in_index = 1
        and table_name in ('trips', 'stop_times', 'stops')
      order by table_name, index_name`.execute(db);
    assert.deepEqual(rows, [
      {
        table_name: 'stop_times',
        index_name: 'idx_stop_times_source_id',
        sub_part: 191,
      },
      {
        table_name: 'stops',
        index_name: 'idx_stops_source_id_stop_lat_stop_lon',
        sub_part: 191,
      },
      { table_name: 'trips', index_name: 'idx_trips_source_id', sub_part: 191 },
    ]);
    for (const tableName of ['trips', 'stop_times']) {
      for (const query of [
        sql<{
          possible_keys: string | null;
        }>`explain select source_id from ${sql.table(tableName)} where source_id = ${'integration'} limit 1`,
        sql<{
          possible_keys: string | null;
        }>`explain delete from ${sql.table(tableName)} where source_id = ${'integration'}`,
      ]) {
        const explained = await query.execute(db);
        assert.ok(
          explained.rows.some((row) =>
            row.possible_keys
              ?.split(',')
              .includes(`idx_${tableName}_source_id`),
          ),
          tableName,
        );
      }
    }
  } else if (dialect === 'postgres') {
    const { rows } = await sql<{
      indexname: string;
    }>`
      select indexname from pg_indexes where schemaname = current_schema()
        and indexname in ('idx_trips_source_id', 'idx_stop_times_source_id', 'idx_stops_source_id')`.execute(
      db,
    );
    assert.deepEqual(rows, []);
  }
}
export async function verifyDatabase(
  db: Kysely<ConformanceDatabase>,
  dialect: GtfsDatabaseDialect,
): Promise<void> {
  await dropTodsTestTables({ client: db });
  const fixturePath = mkdtempSync(path.join(tmpdir(), `gtfs-${dialect}-`));
  const context: DatabaseConformanceContext = { db, dialect, fixturePath };
  try {
    await prepareDatabaseConformanceFixture(context);
    await verifySourceLookupIndexes(db, dialect);
    await verifyImportedAgencyIdentities(context);
    await verifyNormalizedStorageValues(context);
    await verifyRepositoryValueProjections(context);
    await verifyRealtimeExpirationBoundaries(context);
    await verifyPortableKeysAndSchema(context);
    await verifySourceImportPolicies(context);
    await verifyExistingSourceRejection(context);
    await verifyImportResultCounts({ client: db });
    // Export recreates the schema after the shared-fixture checks.
    await verifyCompleteScheduleExport(context);
  } finally {
    await rm(fixturePath, { recursive: true, force: true });
  }
}
