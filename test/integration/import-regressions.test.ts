import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';

import { describe, it } from 'node:test';
import { GtfsErrorCode, importGtfs } from '../../src/index.ts';

const importFixture = (
  db: Database.Database,
  fixturePath: string,
  onSourceError: 'abort' | 'continue' = 'abort',
) =>
  importGtfs({
    database: { client: db },
    sources: [
      {
        sourceId: 'test',
        schedule: {
          path: fixturePath,
          import: {
            onSourceError,
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

describe('GTFS import regressions:', () => {
  it('should accept a Flex stop time that uses location_group_id instead of stop_id', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-flex-'));
    const db = new Database(':memory:');

    try {
      await writeFile(
        path.join(fixturePath, 'stop_times.txt'),
        [
          'trip_id,location_group_id,stop_sequence',
          'trip-1,location-group-1,1',
          '',
        ].join('\n'),
      );

      await importFixture(db, fixturePath);

      const stopTime = db.prepare('SELECT * FROM stop_times').get() as {
        stop_id: string | null;
        location_group_id: string | null;
      };
      assert.equal(stopTime.stop_id, null);
      assert.deepEqual(stopTime.location_group_id, 'location-group-1');
    } finally {
      db.close();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('should create declared indexes without changing imported rows', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-indexes-'));
    const db = new Database(':memory:');

    try {
      await importFixture(db, fixturePath);

      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN (?, ?, ?, ?) ORDER BY name",
        )
        .all(
          'idx_calendar_dates_date_exception_type_service_id',
          'idx_stop_times_stop_id_arrival_service_day_seconds',
          'idx_trips_route_id_service_id_trip_id',
          'idx_trips_service_id',
        ) as { name: string }[];

      assert.deepEqual(
        indexes.map(({ name }) => name),
        [
          'idx_calendar_dates_date_exception_type_service_id',
          'idx_stop_times_stop_id_arrival_service_day_seconds',
          'idx_trips_route_id_service_id_trip_id',
          'idx_trips_service_id',
        ],
      );
    } finally {
      db.close();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('should apply schema default values during normalization', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-defaults-'));
    const db = new Database(':memory:');

    try {
      await writeFile(
        path.join(fixturePath, 'transfers.txt'),
        ['from_stop_id,to_stop_id', 'from-stop,to-stop', ''].join('\n'),
      );

      await importFixture(db, fixturePath);

      const transfer = db
        .prepare('SELECT transfer_type FROM transfers')
        .get() as { transfer_type: number };
      assert.deepEqual(transfer.transfer_type, 0);
    } finally {
      db.close();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('should retain SQLite batch rollback and duplicate reporting behavior', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-duplicates-'));
    const db = new Database(':memory:');

    try {
      await writeFile(
        path.join(fixturePath, 'stops.txt'),
        ['stop_id,stop_name', 'duplicate,First', 'duplicate,Second', ''].join(
          '\n',
        ),
      );

      const report = await importFixture(db, fixturePath, 'continue');

      const { count } = db
        .prepare('SELECT COUNT(*) AS count FROM stops')
        .get() as {
        count: number;
      };
      assert.deepEqual(count, 0);
      assert.deepEqual(
        report.errorCountsByCode[GtfsErrorCode.DATABASE_OPERATION_FAILED],
        1,
      );
    } finally {
      db.close();
      await rm(fixturePath, { recursive: true, force: true });
    }
  });
});
