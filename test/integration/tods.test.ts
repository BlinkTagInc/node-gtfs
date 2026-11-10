import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { stringify } from 'csv-stringify/sync';
import {
  Gtfs,
  GtfsErrorCode,
  GtfsValidationNoticeCode,
  importGtfs,
} from '../../src/index.ts';
import { resolveGtfsExtensions } from '../../src/schema/extensions.ts';
import { completeFixturePath } from '../helpers/test-utils.ts';
import { verifyTodsV1RoundTrip } from '../contracts/cases/tods.ts';
import v1Rows from '../fixtures/complete-extensions/tods-v1.json' with { type: 'json' };
import { stageGtfsSource } from '../../src/schedule/import/process-source.ts';
import { fileBackedTables } from '../../src/schema/table-registry.ts';
test('TODS versions are explicitly exclusive', () => {
  assert.deepEqual(resolveGtfsExtensions(['tods-v1']), ['tods-v1']);
  for (const extensions of [
    ['tods', 'tods-v1'],
    ['tods-v1', 'tods'],
  ] as const) {
    assert.throws(() => resolveGtfsExtensions(extensions), {
      code: GtfsErrorCode.CONFIG_INVALID,
    });
    assert.throws(() => new Gtfs({ database: {}, extensions }), {
      code: GtfsErrorCode.CONFIG_INVALID,
    });
  }
});
test('TODS supplement references accept operational-only rows and require only their primary keys', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-tods-references-'));
  try {
    await cp(completeFixturePath, directory, { recursive: true });
    await writeFile(
      path.join(directory, 'routes_supplement.txt'),
      'route_id,route_long_name\nOPS_ROUTE,Staff Shuttle\n',
    );
    await writeFile(
      path.join(directory, 'calendar_supplement.txt'),
      'service_id\nOPS_SERVICE\n',
    );
    await writeFile(
      path.join(directory, 'trips_supplement.txt'),
      'trip_id,route_id,service_id\nOPS_TRIP,OPS_ROUTE,OPS_SERVICE\n',
    );
    await writeFile(
      path.join(directory, 'stops_supplement.txt'),
      'stop_id,TODS_location_type\nOPS_STOP,Garage\n',
    );
    await writeFile(
      path.join(directory, 'stop_times_supplement.txt'),
      'trip_id,stop_sequence,stop_id\nOPS_TRIP,1,OPS_STOP\n',
    );
    const staged = await stageGtfsSource({
      sourceId: 'test',
      directory,
      tables: fileBackedTables.filter(
        (table) =>
          table.specification === 'gtfs-schedule' ||
          table.specification === 'tods',
      ),
      mode: 'strict',
      onUnknownField: 'reject',
    });
    t.after(() => staged.close());
    const validation = staged.validation;
    assert.equal(validation.valid, true);
    assert.equal(validation.shouldReject, false);
    assert.deepEqual(
      validation.samples.filter((notice) =>
        notice.filename.includes('_supplement'),
      ),
      [],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
for (const [label, contents, code, field] of [
  [
    'invalid deletion marker',
    'route_id,TODS_delete\nFR1,0\n',
    GtfsValidationNoticeCode.INVALID_VALUE,
    'TODS_delete',
  ],
  [
    'missing identity',
    'route_id,TODS_delete\n,1\n',
    GtfsValidationNoticeCode.REQUIRED_VALUE_MISSING,
    'route_id',
  ],
  [
    'duplicate identity',
    'route_id,TODS_delete\nFR1,1\nFR1,1\n',
    GtfsValidationNoticeCode.DUPLICATE_PRIMARY_KEY,
    undefined,
  ],
] as const) {
  test(`TODS supplement rejects ${label}`, async (t) => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'gtfs-tods-validation-'),
    );
    try {
      await cp(completeFixturePath, directory, { recursive: true });
      await writeFile(path.join(directory, 'routes_supplement.txt'), contents);
      const staged = await stageGtfsSource({
        sourceId: 'test',
        directory,
        tables: fileBackedTables.filter(
          (table) =>
            table.specification === 'gtfs-schedule' ||
            table.specification === 'tods',
        ),
        mode: 'strict',
        onUnknownField: 'reject',
      });
      t.after(() => staged.close());
      const validation = staged.validation;
      assert.equal(validation.valid, false);
      assert.equal(validation.shouldReject, true);
      const notice = validation.samples.find((item) => item.code === code);
      assert.ok(notice);
      assert.equal(notice.filename, 'routes_supplement.txt');
      assert.equal(notice.field, field);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
test('native SQLite preserves all v1 files and rejects mixed-version databases', async () => {
  const database = new Database(':memory:');
  try {
    await verifyTodsV1RoundTrip({ client: database });
  } finally {
    database.close();
  }
});
for (const withCurrentSource of [false, true]) {
  test(`auto leaves v1 disabled with one grouped warning; current source=${withCurrentSource}`, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-tods-auto-'));
    const database = new Database(':memory:');
    try {
      const legacyPath = path.join(directory, 'v1');
      await cp(completeFixturePath, legacyPath, { recursive: true });
      for (const [filename, rows] of Object.entries(v1Rows)) {
        await writeFile(
          path.join(legacyPath, filename),
          stringify(rows, { header: true }),
        );
      }
      const sources = [{ sourceId: 'old', schedule: { path: legacyPath } }];
      if (withCurrentSource) {
        const currentPath = path.join(directory, 'current');
        await cp(completeFixturePath, currentPath, { recursive: true });
        await writeFile(
          path.join(currentPath, 'vehicles.txt'),
          'vehicle_id,vehicle_label\nBUS1,Bus One\n',
        );
        sources.push({ sourceId: 'current', schedule: { path: currentPath } });
      }
      const result = await importGtfs({
        database: { client: database },
        extensions: 'auto',
        sources,
        reporting: { level: 'silent' },
      });
      assert.equal(result.success, true);
      const notices = result.validation.samples.filter(
        (notice) => notice.code === GtfsValidationNoticeCode.EXTENSION_DISABLED,
      );
      assert.equal(notices.length, 1);
      assert.equal(notices[0]?.sourceId, 'old');
      assert.equal(notices[0]?.details?.extension, 'tods-v1');
      assert.deepEqual(
        notices[0]?.details?.filenames,
        Object.keys(v1Rows).sort(),
      );
      assert.match(notices[0]?.message ?? '', /tods-v1/);
      const tableNames = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .pluck()
        .all();
      assert.equal(tableNames.includes('run_event'), false);
      assert.equal(tableNames.includes('run_events'), withCurrentSource);
      if (withCurrentSource) {
        assert.deepEqual(
          database
            .prepare('SELECT source_id, vehicle_id FROM tods_vehicles')
            .all(),
          [{ source_id: 'current', vehicle_id: 'BUS1' }],
        );
      }
    } finally {
      database.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}
test('TODS supplements preserve partial rows, blanks, exact field names, and deletion markers without changing Schedule', async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'gtfs-tods-supplements-'),
  );
  const database = new Database(':memory:');
  const gtfs = new Gtfs({
    database: { client: database },
    extensions: ['tods'],
    reporting: { level: 'silent' },
  });
  try {
    await cp(completeFixturePath, directory, { recursive: true });
    await writeFile(
      path.join(directory, 'routes_supplement.txt'),
      'route_id,route_long_name,TODS_delete\nFR1,Operational Red,\nFR2,,1\nOPS,Staff Shuttle,\n',
    );
    await writeFile(
      path.join(directory, 'stops_supplement.txt'),
      'stop_id,TODS_location_type\nFSTOP1,Garage\n',
    );
    const result = await importGtfs({
      database: { client: database },
      extensions: ['tods'],
      sources: [{ sourceId: 'test', schedule: { path: directory } }],
      reporting: { level: 'silent' },
    });
    assert.equal(result.success, true);
    assert.deepEqual(
      await gtfs.tods.routesSupplement
        .select('route_id', 'route_long_name', 'route_type', 'TODS_delete')
        .orderBy([{ field: 'route_id', direction: 'asc' }])
        .all(),
      [
        {
          route_id: 'FR1',
          route_long_name: 'Operational Red',
          route_type: null,
          TODS_delete: null,
        },
        {
          route_id: 'FR2',
          route_long_name: null,
          route_type: null,
          TODS_delete: 1,
        },
        {
          route_id: 'OPS',
          route_long_name: 'Staff Shuttle',
          route_type: null,
          TODS_delete: null,
        },
      ],
    );
    assert.equal(
      (await gtfs.schedule.routes.where({ route_id: 'FR1' }).first())
        ?.route_long_name,
      'Red Line',
    );
    assert.equal(await gtfs.schedule.routes.count(), 2);
    assert.deepEqual(
      await gtfs.tods.stopsSupplement
        .select('stop_id', 'location_type', 'TODS_location_type')
        .first(),
      { stop_id: 'FSTOP1', location_type: null, TODS_location_type: 'Garage' },
    );
  } finally {
    await gtfs.close();
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
