import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';

import {
  exportGtfs,
  Gtfs,
  GtfsErrorCode,
  importGtfs,
  isGtfsError,
  type GtfsReportEvent,
  type GtfsExportOptions,
  type GtfsExportResult,
} from '../../src/index.ts';
import { describe, it } from 'node:test';

const fixturePath = fileURLToPath(
  new URL('../fixtures/export-fidelity', import.meta.url),
);

async function importFixture(database: Database.Database): Promise<void> {
  await importGtfs({
    database: { client: database },
    sources: [
      {
        sourceId: 'fidelity',
        schedule: {
          path: fixturePath,
          import: {
            validation: {
              mode: 'permissive',
              onUnknownField: 'preserve',
            },
          },
        },
      },
    ],
    reporting: { level: 'silent' },
  });
}

async function readCsvRows(
  filePath: string,
): Promise<Record<string, string>[]> {
  return parse(await readFile(filePath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
}

async function runExport(
  api: 'standalone' | 'instance',
  options: GtfsExportOptions,
): Promise<GtfsExportResult> {
  if (api === 'standalone') {
    return exportGtfs(options);
  }
  const gtfs = new Gtfs(options);
  try {
    return await gtfs.export();
  } finally {
    await gtfs.close();
  }
}

for (const api of ['standalone', 'instance'] as const) {
  describe(`${api} export fidelity`, () => {
    it('preserves CSV edge cases, unknown fields, multiple agencies, and GeoJSON', async () => {
      const temporaryDirectory = await mkdtemp(
        path.join(tmpdir(), 'gtfs-export-fidelity-'),
      );
      const outputDirectory = path.join(temporaryDirectory, 'export');
      const database = new Database(':memory:');

      try {
        await importFixture(database);
        assert.equal(
          (
            database
              .prepare('select count(*) as count from fare_attributes')
              .get() as { count: number }
          ).count,
          0,
        );

        const events: GtfsReportEvent[] = [];
        const result = await runExport(api, {
          database: { client: database },
          export: {
            outputDirectory: path.relative(process.cwd(), outputDirectory),
            batchSize: 1,
          },
          reporting: { reporter: (event) => events.push(event) },
        });

        assert.equal(result.sourceId, 'fidelity');
        assert.equal(result.outputDirectory, outputDirectory);
        assert.equal(path.isAbsolute(result.outputDirectory), true);
        assert.equal(Number.isFinite(result.durationMs), true);
        assert.ok(result.durationMs >= 0);
        assert.deepEqual(Object.keys(result).sort(), [
          'durationMs',
          'files',
          'outputDirectory',
          'sourceId',
        ]);
        assert.deepEqual(
          Object.fromEntries(
            result.files.map(({ filename, recordCount }) => [
              filename,
              recordCount,
            ]),
          ),
          {
            'agency.txt': 2,
            'calendar_dates.txt': 1,
            'locations.geojson': 1,
            'routes.txt': 2,
            'stops.txt': 2,
            'stop_times.txt': 2,
            'trips.txt': 2,
          },
        );
        assert.deepEqual(
          result.files.map(({ filename }) => filename).sort(),
          (await readdir(outputDirectory)).sort(),
        );
        assert.ok(Object.isFrozen(result));
        assert.ok(Object.isFrozen(result.files));
        for (const file of result.files) {
          assert.ok(Object.isFrozen(file));
          assert.deepEqual(Object.keys(file).sort(), [
            'filename',
            'recordCount',
          ]);
        }
        const completion = events.find(
          (event) => event.type === 'operation:complete',
        );
        assert.ok(completion?.type === 'operation:complete');
        assert.equal(completion.durationMs, result.durationMs);
        assert.equal(completion.destination, result.outputDirectory);

        assert.deepEqual(
          events
            .filter((event) => event.level === 'warn')
            .map((event) => ({
              type: event.type,
              message: event.message,
            })),
          [
            {
              type: 'message',
              message:
                'More than one agency belongs to source "fidelity"; exporting them in one GTFS file',
            },
          ],
        );

        const agencies = await readCsvRows(
          path.join(outputDirectory, 'agency.txt'),
        );
        agencies.sort((left, right) =>
          (left.agency_id ?? '').localeCompare(right.agency_id ?? ''),
        );
        assert.equal(agencies.length, 2);
        assert.deepEqual(
          agencies.map(({ agency_id }) => agency_id),
          ['north', 'south'],
        );
        assert.equal(agencies[0]?.agency_name, 'Metro, "North"\nTransit');
        assert.equal(agencies[0]?.custom_note, 'Quoted "note", café');
        assert.equal(agencies[1]?.agency_name, '南線 🚋');
        assert.equal(agencies[1]?.custom_note, '');

        const stops = await readCsvRows(
          path.join(outputDirectory, 'stops.txt'),
        );
        stops.sort((left, right) =>
          (left.stop_id ?? '').localeCompare(right.stop_id ?? ''),
        );
        assert.equal(stops[0]?.stop_name, 'Main, "Central"\nStation');
        assert.equal(stops[0]?.stop_desc, '');
        assert.equal(stops[0]?.custom_stop, 'naïve, café');
        assert.equal(stops[1]?.stop_desc, 'Line one\nLine two');
        assert.equal(stops[1]?.custom_stop, '雪');

        const locations = JSON.parse(
          await readFile(
            path.join(outputDirectory, 'locations.geojson'),
            'utf8',
          ),
        ) as {
          type: string;
          features: Array<{
            id: string;
            properties: Record<string, unknown>;
            geometry: { type: string };
          }>;
        };
        assert.equal(locations.type, 'FeatureCollection');
        assert.equal(locations.features.length, 1);
        assert.deepEqual(locations.features[0], {
          type: 'Feature',
          id: 'zone-東京',
          properties: {
            custom_location: 'café 🚋',
            empty_property: '',
            stop_name: 'Zone, "Central"',
            stop_desc: 'Line one\nLine two',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-122.43, 37.76],
                [-122.41, 37.76],
                [-122.41, 37.78],
                [-122.43, 37.76],
              ],
            ],
          },
        });

        assert.equal(
          existsSync(path.join(outputDirectory, 'fare_attributes.txt')),
          false,
        );
      } finally {
        database.close();
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    });

    it('removes incomplete output after a write failure', async () => {
      const temporaryDirectory = await mkdtemp(
        path.join(tmpdir(), 'gtfs-export-failure-'),
      );
      const outputDirectory = path.join(temporaryDirectory, 'export');
      const database = new Database(':memory:');
      let failureInjected = false;
      const reporter = (event: GtfsReportEvent): void => {
        if (
          !failureInjected &&
          event.type === 'status' &&
          event.phase === 'complete' &&
          event.message.includes('agency.txt')
        ) {
          failureInjected = true;
          mkdirSync(path.join(outputDirectory, 'calendar_dates.txt'));
        }
      };

      try {
        await importFixture(database);
        await assert.rejects(
          runExport(api, {
            database: { client: database },
            export: { outputDirectory },
            reporting: { reporter },
          }),
          (error: unknown) =>
            isGtfsError(error) &&
            error.code === GtfsErrorCode.EXPORT_WRITE_FAILED &&
            error.details?.filename === 'calendar_dates.txt',
        );
        assert.equal(failureInjected, true);
        assert.equal(existsSync(outputDirectory), false);
        assert.deepEqual(await readdir(temporaryDirectory), []);
      } finally {
        database.close();
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    });
  });
}
