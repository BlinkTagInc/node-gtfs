import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { describe, test } from 'node:test';

import Database from 'better-sqlite3';

import { importGtfs } from '../../src/operations.ts';
import { GtfsErrorCode } from '../../src/diagnostics/errors.ts';

async function writeMinimalSchedule(
  directory: string,
  agencyName: string,
  stopName = 'Stop 1',
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

describe('v5 Schedule import configuration', () => {
  test('uses the stable default identity for one source without sourceId', async () => {
    const database = new Database(':memory:');
    const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-default-source-'));
    try {
      await writeMinimalSchedule(directory, 'Default Source');
      await importGtfs({
        database: { client: database },
        sources: [{ schedule: { path: directory } }],
        reporting: { level: 'silent' },
      });

      assert.deepEqual(
        database.prepare('SELECT DISTINCT source_id FROM agency').pluck().all(),
        ['default'],
      );
    } finally {
      database.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('applies validation and source-error policy independently per source', async () => {
    const database = new Database(':memory:');
    try {
      const result = await importGtfs({
        database: { client: database },
        extensions: 'auto',
        sources: [
          {
            sourceId: 'invalid-first',
            schedule: {
              path: 'test/fixtures/translations-polymorphic',
              import: {
                onSourceError: 'continue',
                validation: {
                  mode: 'strict',
                },
              },
            },
          },
          {
            sourceId: 'complete-second',
            schedule: {
              path: 'test/fixtures/complete',
              import: {
                onSourceError: 'abort',
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

      assert.ok('errors' in result);
      assert.equal(result.errors.length, 1);
      assert.deepEqual(
        database
          .prepare('SELECT DISTINCT source_id FROM agency ORDER BY source_id')
          .pluck()
          .all(),
        ['complete-second'],
      );
    } finally {
      database.close();
    }
  });

  test('stops before later sources when the failing source uses abort', async () => {
    const database = new Database(':memory:');
    try {
      await assert.rejects(
        importGtfs({
          database: { client: database },
          extensions: 'auto',
          sources: [
            {
              sourceId: 'invalid-first',
              schedule: {
                path: 'test/fixtures/translations-polymorphic',
                import: {
                  onSourceError: 'abort',
                  validation: { mode: 'strict' },
                },
              },
            },
            {
              sourceId: 'unreached-second',
              schedule: {
                path: 'test/fixtures/complete',
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
        }),
      );
      assert.deepEqual(
        database.prepare('SELECT source_id FROM agency').all(),
        [],
      );
    } finally {
      database.close();
    }
  });

  test('replaces only the importing source by default', async () => {
    const firstDirectory = mkdtempSync(
      path.join(tmpdir(), 'gtfs-source-policy-first-'),
    );
    const secondDirectory = mkdtempSync(
      path.join(tmpdir(), 'gtfs-source-policy-second-'),
    );
    const database = new Database(':memory:');

    try {
      await writeMinimalSchedule(firstDirectory, 'First Agency');
      await writeMinimalSchedule(secondDirectory, 'Replacement Agency');
      await writeFile(
        path.join(firstDirectory, 'stops.txt'),
        [
          'stop_id,stop_name,stop_lat,stop_lon',
          'stop-1,Stop 1,0,0',
          'stop-2,Stop 2,1,1',
          '',
        ].join('\n'),
      );

      await importGtfs({
        database: { client: database },
        sources: [
          {
            sourceId: 'same-source',
            schedule: { path: firstDirectory },
          },
          {
            sourceId: 'other-source',
            schedule: { path: firstDirectory },
          },
        ],
        reporting: { level: 'silent' },
      });

      await importGtfs({
        database: { client: database },
        sources: [
          {
            sourceId: 'same-source',
            schedule: { path: secondDirectory },
          },
        ],
        reporting: { level: 'silent' },
      });

      assert.equal(
        database
          .prepare('SELECT agency_name FROM agency WHERE source_id = ?')
          .pluck()
          .get('same-source'),
        'Replacement Agency',
      );
      assert.equal(
        database
          .prepare('SELECT COUNT(*) FROM stops WHERE source_id = ?')
          .pluck()
          .get('same-source'),
        1,
      );
      assert.equal(
        database
          .prepare('SELECT agency_name FROM agency WHERE source_id = ?')
          .pluck()
          .get('other-source'),
        'First Agency',
      );
      assert.equal(
        database
          .prepare('SELECT COUNT(*) FROM stops WHERE source_id = ?')
          .pluck()
          .get('other-source'),
        2,
      );
    } finally {
      database.close();
      await Promise.all([
        rm(firstDirectory, { recursive: true, force: true }),
        rm(secondDirectory, { recursive: true, force: true }),
      ]);
    }
  });

  test('rejects an existing source without changing its rows', async () => {
    const firstDirectory = mkdtempSync(
      path.join(tmpdir(), 'gtfs-source-reject-first-'),
    );
    const secondDirectory = mkdtempSync(
      path.join(tmpdir(), 'gtfs-source-reject-second-'),
    );
    const database = new Database(':memory:');

    try {
      await writeMinimalSchedule(firstDirectory, 'First Agency');
      await writeMinimalSchedule(secondDirectory, 'Replacement Agency');
      await importGtfs({
        database: { client: database },
        sources: [
          {
            sourceId: 'same-source',
            schedule: { path: firstDirectory },
          },
        ],
        reporting: { level: 'silent' },
      });

      await assert.rejects(
        importGtfs({
          database: { client: database },
          sources: [
            {
              sourceId: 'same-source',
              schedule: {
                path: secondDirectory,
                import: { onExistingData: 'reject' },
              },
            },
          ],
          reporting: { level: 'silent' },
        }),
        (error: unknown) => {
          const candidate = error as {
            code?: unknown;
            details?: Readonly<Record<string, unknown>>;
          };
          return (
            candidate.code === GtfsErrorCode.DATABASE_SOURCE_EXISTS &&
            candidate.details?.sourceId === 'same-source' &&
            candidate.details.onExistingData === 'reject' &&
            Array.isArray(candidate.details.tables)
          );
        },
      );
      assert.equal(
        database
          .prepare('SELECT agency_name FROM agency WHERE source_id = ?')
          .pluck()
          .get('same-source'),
        'First Agency',
      );
    } finally {
      database.close();
      await Promise.all([
        rm(firstDirectory, { recursive: true, force: true }),
        rm(secondDirectory, { recursive: true, force: true }),
      ]);
    }
  });

  test('restores an existing source when replacement writing fails', async () => {
    const firstDirectory = mkdtempSync(
      path.join(tmpdir(), 'gtfs-source-atomic-first-'),
    );
    const secondDirectory = mkdtempSync(
      path.join(tmpdir(), 'gtfs-source-atomic-second-'),
    );
    const database = new Database(':memory:');

    try {
      await writeMinimalSchedule(firstDirectory, 'First Agency', 'First Stop');
      await writeMinimalSchedule(
        secondDirectory,
        'Replacement Agency',
        'Replacement Stop',
      );
      await importGtfs({
        database: { client: database },
        sources: [
          {
            sourceId: 'same-source',
            schedule: { path: firstDirectory },
          },
        ],
        reporting: { level: 'silent' },
      });
      database.exec(`
        CREATE TRIGGER fail_replacement_stop
        BEFORE INSERT ON stops
        WHEN NEW.source_id = 'same-source'
          AND NEW.stop_name = 'Replacement Stop'
        BEGIN
          SELECT RAISE(ABORT, 'injected replacement failure');
        END
      `);

      await assert.rejects(
        importGtfs({
          database: { client: database },
          sources: [
            {
              sourceId: 'same-source',
              schedule: { path: secondDirectory },
            },
          ],
          reporting: { level: 'silent' },
        }),
        (error: unknown) =>
          (error as { code?: unknown }).code ===
          GtfsErrorCode.DATABASE_OPERATION_FAILED,
      );

      assert.equal(database.inTransaction, false);
      assert.deepEqual(
        database
          .prepare(
            'SELECT agency_name FROM agency WHERE source_id = ? ORDER BY agency_name',
          )
          .pluck()
          .all('same-source'),
        ['First Agency'],
      );
      assert.deepEqual(
        database
          .prepare(
            'SELECT stop_name FROM stops WHERE source_id = ? ORDER BY stop_name',
          )
          .pluck()
          .all('same-source'),
        ['First Stop'],
      );
    } finally {
      database.close();
      await Promise.all([
        rm(firstDirectory, { recursive: true, force: true }),
        rm(secondDirectory, { recursive: true, force: true }),
      ]);
    }
  });
});
