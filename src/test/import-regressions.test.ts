import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { describe, it, expect } from './test-utils.ts';
import {
  closeDb,
  GtfsErrorCode,
  GtfsWarningCode,
  importGtfs,
  openDb,
} from '../../dist/index.js';

describe('GTFS import regressions:', () => {
  it('should accept a Flex stop time that uses location_group_id instead of stop_id', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-flex-'));
    const db = openDb();

    try {
      await writeFile(
        path.join(fixturePath, 'stop_times.txt'),
        [
          'trip_id,location_group_id,stop_sequence',
          'trip-1,location-group-1,1',
          '',
        ].join('\n'),
      );

      await importGtfs({
        agencies: [{ path: fixturePath }],
        logLevel: 'silent',
      });

      const stopTime = db.prepare('SELECT * FROM stop_times').get() as {
        stop_id: string | null;
        location_group_id: string | null;
      };
      expect(stopTime.stop_id).toBeNull();
      expect(stopTime.location_group_id).toEqual('location-group-1');
    } finally {
      closeDb(db);
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('should create query-oriented indexes without changing imported rows', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-indexes-'));
    const db = openDb();

    try {
      await importGtfs({
        agencies: [{ path: fixturePath }],
        logLevel: 'silent',
      });

      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN (?, ?, ?, ?) ORDER BY name",
        )
        .all(
          'idx_calendar_dates_date_exception_type_service_id',
          'idx_frequencies_trip_id',
          'idx_stop_times_stop_id_trip_id_stop_sequence',
          'idx_trips_route_id_service_id_trip_id',
        ) as { name: string }[];

      expect(indexes.map(({ name }) => name)).toEqual([
        'idx_calendar_dates_date_exception_type_service_id',
        'idx_frequencies_trip_id',
        'idx_stop_times_stop_id_trip_id_stop_sequence',
        'idx_trips_route_id_service_id_trip_id',
      ]);
    } finally {
      closeDb(db);
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('should apply schema default values during normalization', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-defaults-'));
    const db = openDb();

    try {
      await writeFile(
        path.join(fixturePath, 'transfers.txt'),
        ['from_stop_id,to_stop_id', 'from-stop,to-stop', ''].join('\n'),
      );

      await importGtfs({
        agencies: [{ path: fixturePath }],
        logLevel: 'silent',
      });

      const transfer = db
        .prepare('SELECT transfer_type FROM transfers')
        .get() as { transfer_type: number };
      expect(transfer.transfer_type).toEqual(0);
    } finally {
      closeDb(db);
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it('should retain SQLite batch rollback and duplicate reporting behavior', async () => {
    const fixturePath = mkdtempSync(path.join(tmpdir(), 'gtfs-duplicates-'));
    const db = openDb();

    try {
      await writeFile(
        path.join(fixturePath, 'stops.txt'),
        ['stop_id,stop_name', 'duplicate,First', 'duplicate,Second', ''].join(
          '\n',
        ),
      );

      const report = await importGtfs({
        agencies: [{ path: fixturePath }],
        ignoreErrors: true,
        includeImportReport: true,
        logLevel: 'silent',
      });

      const { count } = db
        .prepare('SELECT COUNT(*) AS count FROM stops')
        .get() as {
        count: number;
      };
      expect(count).toEqual(0);
      expect(
        report.errorCountsByCode[GtfsErrorCode.GTFS_DB_OPERATION_FAILED],
      ).toEqual(1);
      expect(
        report.warningCountsByCode[GtfsWarningCode.GTFS_DUPLICATE_PRIMARY_KEY],
      ).toEqual(1);
    } finally {
      closeDb(db);
      await rm(fixturePath, { recursive: true, force: true });
    }
  });
});
