import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

import {
  exportGtfs,
  Gtfs,
  importGtfs,
  type GtfsImportOptions,
} from '../../../src/index.ts';

function createSourceFixture(sourceId: 'north' | 'south') {
  const name = sourceId === 'north' ? 'North' : 'South';
  const routeType = sourceId === 'north' ? 3 : 2;
  const hour = sourceId === 'north' ? '08' : '09';
  const ids = [sourceId + '-only', 'shared'];
  return {
    sourceId,
    files: {
      'agency.txt': [
        {
          agency_id: 'shared',
          agency_name: `${name} Transit`,
          agency_url: `https://${sourceId}.example.com`,
          agency_timezone: 'Etc/UTC',
        },
      ],
      'routes.txt': ids.map((id) => ({
        route_id: id,
        agency_id: 'shared',
        route_short_name: `${name} ${id}`,
        route_type: routeType,
      })),
      'trips.txt': ids.map((id) => ({
        trip_id: id,
        route_id: id,
        service_id: 'weekday',
        trip_headsign: `${name} ${id}`,
      })),
      'stops.txt': ids.map((id, index) => ({
        stop_id: id,
        stop_name: `${name} ${id}`,
        stop_lat: (sourceId === 'north' ? 37 : 38) + index,
        stop_lon: -122,
      })),
      'stop_times.txt': ids.flatMap((tripId) =>
        ids.map((stopId, index) => ({
          trip_id: tripId,
          stop_id: stopId,
          stop_sequence: index + 1,
          arrival_time: `${hour}:${index === 0 ? '00' : '10'}:00`,
          departure_time: `${hour}:${index === 0 ? '01' : '11'}:00`,
        })),
      ),
      'calendar_dates.txt': [
        {
          service_id: 'weekday',
          date: sourceId === 'north' ? 20260914 : 20260915,
          exception_type: 1,
        },
      ],
    },
  };
}

async function readScheduleRows(gtfs: Gtfs, sourceId?: string) {
  const where = sourceId === undefined ? {} : { source_id: sourceId };
  return {
    'agency.txt': await gtfs.schedule.agency
      .where(where)
      .select(
        'source_id',
        'agency_id',
        'agency_name',
        'agency_url',
        'agency_timezone',
      )
      .all(),
    'routes.txt': await gtfs.schedule.routes
      .where(where)
      .select(
        'source_id',
        'route_id',
        'agency_id',
        'route_short_name',
        'route_type',
      )
      .all(),
    'trips.txt': await gtfs.schedule.trips
      .where(where)
      .select('source_id', 'trip_id', 'route_id', 'service_id', 'trip_headsign')
      .all(),
    'stops.txt': await gtfs.schedule.stops
      .where(where)
      .select('source_id', 'stop_id', 'stop_name', 'stop_lat', 'stop_lon')
      .all(),
    'stop_times.txt': await gtfs.schedule.stopTimes
      .where(where)
      .select(
        'source_id',
        'trip_id',
        'stop_id',
        'stop_sequence',
        'arrival_time',
        'departure_time',
      )
      .all(),
    'calendar_dates.txt': await gtfs.schedule.calendarDates
      .where(where)
      .select('source_id', 'service_id', 'date', 'exception_type')
      .all(),
  };
}

function sortedRows(
  rows: readonly Readonly<Record<string, unknown>>[],
): string[] {
  return rows.map((row) => JSON.stringify(Object.entries(row).sort())).sort();
}

export async function verifySourceIsolationIntegration(
  database: GtfsImportOptions['database'],
): Promise<void> {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'gtfs-source-isolation-'),
  );
  const fixtures = [createSourceFixture('north'), createSourceFixture('south')];
  const allSources = new Gtfs({ database, reporting: { level: 'silent' } });
  try {
    // Separate imports also verify that ensuring the schema preserves the first feed.
    await allSources.schema.recreate();
    for (const fixture of fixtures) {
      const feedDirectory = path.join(directory, fixture.sourceId);
      await mkdir(feedDirectory);
      for (const [filename, rows] of Object.entries(fixture.files)) {
        await writeFile(
          path.join(feedDirectory, filename),
          stringify(rows, { header: true }),
        );
      }
      const result = await importGtfs({
        database,
        sources: [
          { sourceId: fixture.sourceId, schedule: { path: feedDirectory } },
        ],
        reporting: { level: 'silent' },
      });
      assert.equal(result.success, true);
    }

    const combined = await readScheduleRows(allSources);
    for (const filename of Object.keys(combined) as (keyof typeof combined)[]) {
      assert.deepEqual(
        sortedRows(combined[filename]),
        sortedRows(
          fixtures.flatMap((fixture) =>
            fixture.files[filename].map((row) => ({
              source_id: fixture.sourceId,
              ...row,
            })),
          ),
        ),
        `Both sources coexist in ${filename}`,
      );
    }

    for (const fixture of fixtures) {
      const { sourceId } = fixture;
      const otherSourceId = sourceId === 'north' ? 'south' : 'north';
      const gtfs = new Gtfs({
        database,
        sources: [{ sourceId }],
        reporting: { level: 'silent' },
      });
      try {
        for (const rows of [
          await readScheduleRows(gtfs),
          await readScheduleRows(allSources, sourceId),
        ]) {
          for (const filename of Object.keys(rows) as (keyof typeof rows)[]) {
            assert.deepEqual(
              sortedRows(rows[filename]),
              sortedRows(
                fixture.files[filename].map((row) => ({
                  source_id: sourceId,
                  ...row,
                })),
              ),
              `${sourceId}: isolated repository values for ${filename}`,
            );
          }
        }
        assert.deepEqual(
          await gtfs.schedule.routes.where({ source_id: otherSourceId }).all(),
          [],
        );

        // A shared trip/route ID must not match the other source's route attributes.
        for (const candidate of fixtures) {
          assert.deepEqual(
            await allSources.database.withKysely({
              callback: (db) =>
                db
                  .selectFrom('stop_times as time')
                  .innerJoin('trips as trip', (join) =>
                    join
                      .onRef('trip.source_id', '=', 'time.source_id')
                      .onRef('trip.trip_id', '=', 'time.trip_id'),
                  )
                  .innerJoin('routes as route', (join) =>
                    join
                      .onRef('route.source_id', '=', 'trip.source_id')
                      .onRef('route.route_id', '=', 'trip.route_id'),
                  )
                  .where('time.source_id', '=', sourceId)
                  .where(
                    'route.route_short_name',
                    '=',
                    `${candidate.sourceId === 'north' ? 'North' : 'South'} shared`,
                  )
                  .select([
                    'time.source_id',
                    'time.trip_id',
                    'time.stop_id',
                    'time.stop_sequence',
                    'time.arrival_time',
                    'time.departure_time',
                  ])
                  .orderBy('time.stop_sequence')
                  .execute(),
            }),
            candidate.sourceId === sourceId
              ? fixture.files['stop_times.txt']
                  .filter((row) => row.trip_id === 'shared')
                  .map((row) => ({ source_id: sourceId, ...row }))
              : [],
            `${sourceId}: relationship to ${candidate.sourceId}`,
          );
        }

        for (const api of ['standalone', 'instance'] as const) {
          const outputDirectory = path.join(
            directory,
            `${sourceId}-${api}-export`,
          );
          const result =
            api === 'standalone'
              ? await exportGtfs({
                  database,
                  export: { sourceId, outputDirectory, batchSize: 1 },
                  reporting: { level: 'silent' },
                })
              : await gtfs.export({ outputDirectory, batchSize: 1 });
          assert.equal(result.sourceId, sourceId);
          assert.equal(result.outputDirectory, outputDirectory);
          assert.deepEqual(
            (await readdir(outputDirectory)).sort(),
            Object.keys(fixture.files).sort(),
          );
          assert.deepEqual(
            Object.fromEntries(
              result.files.map(({ filename, recordCount }) => [
                filename,
                recordCount,
              ]),
            ),
            Object.fromEntries(
              Object.entries(fixture.files).map(([filename, rows]) => [
                filename,
                rows.length,
              ]),
            ),
          );
          for (const [filename, expected] of Object.entries(fixture.files)) {
            const exported = parse(
              await readFile(path.join(outputDirectory, filename), 'utf8'),
              {
                columns: true,
                skip_empty_lines: true,
              },
            ) as Record<string, string>[];
            assert.deepEqual(
              sortedRows(
                exported.map((row) =>
                  Object.fromEntries(
                    // Export includes empty optional columns absent from the input fixture.
                    Object.entries(row).filter(([, value]) => value !== ''),
                  ),
                ),
              ),
              sortedRows(
                expected.map((row) =>
                  Object.fromEntries(
                    Object.entries(row).map(([field, value]) => [
                      field,
                      String(value),
                    ]),
                  ),
                ),
              ),
              `${api} ${sourceId}: exact exported records for ${filename}`,
            );
          }
        }
      } finally {
        await gtfs.close();
      }
    }
  } finally {
    await allSources.close();
    await rm(directory, { recursive: true, force: true });
  }
}
