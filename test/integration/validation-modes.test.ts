import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { importGtfs, isGtfsError } from '../../src/index.ts';

const files = {
  'agency.txt':
    'agency_id,agency_name,agency_url,agency_timezone\nagency,Transit,https://example.test,Etc/UTC\n',
  'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\nstop,Original,0,0\n',
  'routes.txt':
    'route_id,agency_id,route_short_name,route_type\nroute,agency,R,3\n',
  'trips.txt': 'route_id,service_id,trip_id\nroute,service,trip\n',
  'stop_times.txt':
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence\ntrip,09:00:00,09:00:00,stop,1\n',
  'calendar_dates.txt': 'service_id,date,exception_type\nservice,20260101,1\n',
};

for (const mode of ['off', 'strict', 'permissive'] as const) {
  for (const problem of ['unrepresentable-row', 'missing-reference'] as const) {
    test(`${mode} import handles ${problem} according to its validation policy`, async (t) => {
      const directory = await mkdtemp(
        path.join(tmpdir(), 'gtfs-validation-modes-'),
      );
      t.after(() => rm(directory, { recursive: true, force: true }));
      const database = new Database(':memory:');
      t.after(() => database.close());
      await Promise.all(
        Object.entries(files).map(([filename, contents]) =>
          writeFile(path.join(directory, filename), contents),
        ),
      );
      const run = () =>
        importGtfs({
          database: { client: database },
          sources: [
            { schedule: { path: directory, import: { validation: { mode } } } },
          ],
          reporting: { level: 'silent' },
        });
      const initial = await run();
      assert.equal(initial.success, true);
      assert.deepEqual(initial.validation.samples, []);

      if (problem === 'unrepresentable-row') {
        await writeFile(
          path.join(directory, 'stops.txt'),
          'stop_id,stop_name,stop_lat,stop_lon\nstop,Updated,0,0\ninvalid,Invalid,not-a-number,0\n',
        );
        if (mode === 'permissive') {
          const result = await run();
          assert.equal(result.success, true);
          assert.deepEqual(
            result.validation.samples.map(
              ({ code, severity, field, position }) => ({
                code,
                severity,
                field,
                position,
              }),
            ),
            [
              {
                code: 'GTFS_VALIDATION_INVALID_VALUE',
                severity: 'error',
                field: 'stop_lat',
                position: { kind: 'csv', recordNumber: 2, csvLineNumber: 3 },
              },
            ],
          );
        } else {
          await assert.rejects(run, (error: unknown) => {
            assert.ok(isGtfsError(error));
            assert.equal(
              error.code,
              mode === 'strict'
                ? 'GTFS_VALIDATION_FAILED'
                : 'GTFS_INVALID_VALUE',
            );
            return true;
          });
        }
        assert.deepEqual(
          database.prepare('SELECT stop_id, stop_name FROM stops').all(),
          [
            {
              stop_id: 'stop',
              stop_name: mode === 'permissive' ? 'Updated' : 'Original',
            },
          ],
        );
      } else {
        await writeFile(
          path.join(directory, 'trips.txt'),
          'route_id,service_id,trip_id\nmissing-route,service,trip\n',
        );
        const result = await run();
        assert.equal(result.success, true);
        assert.deepEqual(
          result.validation.samples.map(({ code, severity, field }) => ({
            code,
            severity,
            field,
          })),
          mode === 'off'
            ? []
            : [
                {
                  code: 'GTFS_REFERENCE_NOT_FOUND',
                  severity: 'warn',
                  field: 'route_id',
                },
              ],
        );
        assert.deepEqual(database.prepare('SELECT route_id FROM trips').all(), [
          { route_id: 'missing-route' },
        ]);
      }
    });
  }
}
