import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { Kysely, sql } from 'kysely';
import { GtfsErrorCode, importGtfs } from '../../../src/index.ts';
import type { ConformanceDatabase } from './database-types.ts';

async function writeAtomicReplacementFixture(
  directory: string,
  agencyName: string,
  stopName: string,
): Promise<void> {
  await Promise.all([
    writeFile(
      path.join(directory, 'agency.txt'),
      [
        'agency_id,agency_name,agency_url,agency_timezone',
        `agency-1,${agencyName},https://example.com,Etc/UTC`,
        '',
      ].join('\n'),
    ),
    writeFile(
      path.join(directory, 'stops.txt'),
      [
        'stop_id,stop_name,stop_lat,stop_lon',
        `stop-1,${stopName},0,0`,
        '',
      ].join('\n'),
    ),
    writeFile(
      path.join(directory, 'routes.txt'),
      ['route_id,agency_id,route_type', 'route-1,agency-1,3', ''].join('\n'),
    ),
    writeFile(
      path.join(directory, 'trips.txt'),
      ['route_id,service_id,trip_id', 'route-1,service-1,trip-1', ''].join(
        '\n',
      ),
    ),
    writeFile(
      path.join(directory, 'stop_times.txt'),
      [
        'trip_id,arrival_time,departure_time,stop_id,stop_sequence',
        'trip-1,08:00:00,08:00:00,stop-1,1',
        '',
      ].join('\n'),
    ),
    writeFile(
      path.join(directory, 'calendar.txt'),
      [
        'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
        'service-1,1,1,1,1,1,0,0,20260101,20261231',
        '',
      ].join('\n'),
    ),
  ]);
}
export async function verifyAtomicSourceReplacement(
  db: Kysely<ConformanceDatabase>,
  dialect: 'postgres' | 'mysql',
): Promise<void> {
  const firstDirectory = mkdtempSync(
    path.join(tmpdir(), `gtfs-${dialect}-atomic-first-`),
  );
  const secondDirectory = mkdtempSync(
    path.join(tmpdir(), `gtfs-${dialect}-atomic-second-`),
  );
  const constraintName = 'node_gtfs_atomic_replace_guard';
  let constraintCreated = false;
  try {
    await writeAtomicReplacementFixture(
      firstDirectory,
      'First Agency',
      'First Stop',
    );
    await writeAtomicReplacementFixture(
      secondDirectory,
      'Replacement Agency',
      'Replacement Stop',
    );
    await importGtfs({
      database: { client: db },
      sources: [
        {
          sourceId: 'atomic-source',
          schedule: { path: firstDirectory },
        },
      ],
      reporting: { level: 'silent' },
    });
    await sql
      .raw(
        `alter table stops add constraint ${constraintName} check (stop_name <> 'Replacement Stop')`,
      )
      .execute(db);
    constraintCreated = true;
    await assert.rejects(
      async () =>
        importGtfs({
          database: { client: db },
          sources: [
            {
              sourceId: 'atomic-source',
              schedule: { path: secondDirectory },
            },
          ],
          reporting: { level: 'silent' },
        }),
      (error: unknown) =>
        (
          error as {
            code?: unknown;
          }
        ).code === GtfsErrorCode.DATABASE_OPERATION_FAILED,
    );
    const failedImport = await importGtfs({
      database: { client: db },
      sources: [
        {
          sourceId: 'atomic-source',
          schedule: {
            path: secondDirectory,
            import: { onSourceError: 'continue' },
          },
        },
      ],
      reporting: { level: 'silent' },
    });
    assert.equal(failedImport.success, false);
    assert.equal(failedImport.sources[0]?.success, false);
    assert.equal(failedImport.sources[0]?.error, failedImport.errors[0]);
    assert.deepEqual(
      failedImport.sources[0]?.files,
      [
        'agency.txt',
        'calendar.txt',
        'routes.txt',
        'stop_times.txt',
        'stops.txt',
        'trips.txt',
      ].map((filename) => ({
        filename,
        recordsRead: 1,
        rowsInserted: 0,
        rowsSkipped: 0,
      })),
    );
    assert.deepEqual(
      await db
        .selectFrom('agency')
        .select('agency_name')
        .where('source_id', '=', 'atomic-source')
        .execute(),
      [{ agency_name: 'First Agency' }],
    );
    assert.deepEqual(
      await db
        .selectFrom('stops')
        .select('stop_name')
        .where('source_id', '=', 'atomic-source')
        .execute(),
      [{ stop_name: 'First Stop' }],
    );
  } finally {
    if (constraintCreated) {
      await sql
        .raw(
          dialect === 'mysql'
            ? `alter table stops drop check ${constraintName}`
            : `alter table stops drop constraint ${constraintName}`,
        )
        .execute(db);
    }
    await Promise.all([
      rm(firstDirectory, { recursive: true, force: true }),
      rm(secondDirectory, { recursive: true, force: true }),
    ]);
  }
}
