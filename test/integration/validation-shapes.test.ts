import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import {
  GtfsErrorCode,
  GtfsValidationNoticeCode,
} from '../../src/diagnostics/errors.ts';
import { stageGtfsSource } from '../../src/schedule/import/process-source.ts';
import { importGtfs } from '../../src/operations.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import type { GtfsValidationMode } from '../../src/types/config.ts';

const tables = [
  compiledTableRegistry.routes,
  compiledTableRegistry.trips,
  compiledTableRegistry.stopTimes,
  compiledTableRegistry.shapes,
];
const routes =
  'route_id,route_type,continuous_pickup,continuous_drop_off\nr,3,0,1\n';
const trips = 'route_id,service_id,trip_id,shape_id\nr,service,t,s\n';
const stopTimes =
  'trip_id,stop_sequence,continuous_pickup,continuous_drop_off\nt,10,,\nt,20,,\n';
const shapes =
  'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\ns,0,0,1\ns,1,1,2\n';
type Fixture = Partial<
  Record<
    'routes.txt' | 'trips.txt' | 'stop_times.txt' | 'shapes.txt',
    string | null
  >
>;

async function createFeed(t: TestContext, changes: Fixture = {}) {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'gtfs-continuous-shapes-'),
  );
  t.after(() => rm(directory, { recursive: true, force: true }));
  const files = {
    'routes.txt': routes,
    'trips.txt': trips,
    'stop_times.txt': stopTimes,
    'shapes.txt': shapes,
    ...changes,
  };
  for (const [filename, contents] of Object.entries(files)) {
    if (contents !== null) {
      await writeFile(path.join(directory, filename), contents);
    }
  }
  return directory;
}

async function validate(
  t: TestContext,
  changes: Fixture,
  mode: GtfsValidationMode = 'strict',
  excludeFiles: readonly string[] = [],
) {
  const directory = await createFeed(t, changes);
  const staged = await stageGtfsSource({
    directory,
    tables,
    sourceId: 'test',
    mode,
    onUnknownField: 'preserve',
    excludeFiles: ['calendar.txt', 'calendar_dates.txt', ...excludeFiles],
  });
  try {
    return staged.validation;
  } finally {
    await staged.close();
  }
}

test('continuous pickup and drop-off require shapes for every permitting value at either level', async (t) => {
  for (const filename of ['routes.txt', 'stop_times.txt'] as const) {
    for (const field of ['continuous_pickup', 'continuous_drop_off']) {
      for (const value of [0, 2, 3]) {
        await t.test(`${filename}.${field}=${value}`, async (t) => {
          const result = await validate(t, {
            'shapes.txt': null,
            'routes.txt':
              filename === 'routes.txt'
                ? `route_id,route_type,${field}\nr,3,${value}\n`
                : 'route_id,route_type\nr,3\n',
            'stop_times.txt':
              filename === 'stop_times.txt'
                ? `trip_id,stop_sequence,${field}\nt,10,${value}\nt,20,1\n`
                : stopTimes,
          });
          assert.equal(result.valid, false);
          assert.equal(result.shouldReject, true);
          assert.deepEqual(result.samples, [
            {
              code: GtfsValidationNoticeCode.REQUIRED_FILE_MISSING,
              severity: 'error',
              sourceId: 'test',
              filename: 'shapes.txt',
              message:
                'Required GTFS file shapes.txt is missing for continuous pickup or drop-off',
              details: { tripId: 't', routeId: 'r' },
            },
          ]);
        });
      }
    }
  }
});

test('shape requirements distinguish missing files, missing IDs, and missing shape records', async (t) => {
  for (const [name, changes, code] of [
    [
      'missing shape_id value',
      { 'trips.txt': trips.replace('t,s', 't,') },
      GtfsValidationNoticeCode.CONDITIONAL_PRESENCE,
    ],
    [
      'missing shape_id header',
      { 'trips.txt': 'route_id,service_id,trip_id\nr,service,t\n' },
      GtfsValidationNoticeCode.CONDITIONAL_PRESENCE,
    ],
    [
      'empty shape file',
      { 'shapes.txt': '' },
      GtfsValidationNoticeCode.REFERENCE_NOT_FOUND,
    ],
    [
      'header-only shape file',
      { 'shapes.txt': shapes.split('\n')[0] + '\n' },
      GtfsValidationNoticeCode.REFERENCE_NOT_FOUND,
    ],
    [
      'unknown shape ID',
      { 'shapes.txt': shapes.replaceAll('s,', 'other,') },
      GtfsValidationNoticeCode.REFERENCE_NOT_FOUND,
    ],
  ] as const) {
    await t.test(name, async (t) => {
      const result = await validate(t, changes);
      const notices = result.samples.filter(
        (notice) =>
          notice.filename === 'trips.txt' && notice.field === 'shape_id',
      );
      assert.equal(
        notices.length,
        1,
        'Do not emit both a warning and an error for one broken reference',
      );
      assert.equal(notices[0]?.code, code);
      assert.equal(notices[0]?.severity, 'error');
      assert.equal(notices[0]?.sourceId, 'test');
      assert.deepEqual(notices[0]?.position, {
        kind: 'csv',
        recordNumber: 1,
        csvLineNumber: 2,
      });
      assert.equal(result.valid, false);
      assert.equal(result.shouldReject, true);
    });
  }
  const valid = await validate(t, {});
  assert.deepEqual(valid.samples, []);
  assert.equal(valid.valid, true);
});

test('fixed-stop service remains valid without geometry or shape IDs', async (t) => {
  for (const value of ['', '1']) {
    const result = await validate(t, {
      'routes.txt': `route_id,route_type,continuous_pickup,continuous_drop_off\nr,3,${value},${value}\n`,
      'trips.txt': trips.replace('t,s', 't,'),
      'shapes.txt': null,
    });
    assert.deepEqual(result.samples, []);
    assert.equal(result.valid, true);
  }
});

test('stop-time overrides apply per segment and per trip regardless of source row order', async (t) => {
  const cases = [
    ['both route defaults overridden', 't,10,1,1\nt,20,,\n', false],
    ['pickup disabled but drop-off inherited', 't,10,1,\nt,20,,\n', true],
    [
      'only final stop allows continuous service',
      't,10,1,1\nt,20,0,0\n',
      false,
    ],
    ['unsorted explicit segment', 't,30,1,1\nt,10,0,1\nt,20,1,1\n', true],
    ['unsorted final stop only', 't,30,0,0\nt,10,1,1\nt,20,1,1\n', false],
    [
      'missing intermediate settings inherit route',
      't,30,1,1\nt,10,1,1\nt,20,,\n',
      true,
    ],
  ] as const;
  for (const [name, rows, required] of cases) {
    await t.test(name, async (t) => {
      const result = await validate(t, {
        'routes.txt':
          'route_id,route_type,continuous_pickup,continuous_drop_off\nr,3,0,2\n',
        'stop_times.txt': stopTimes.split('\n')[0] + '\n' + rows,
        'shapes.txt': null,
      });
      assert.equal(result.shouldReject, required);
      assert.equal(result.samples.length, required ? 1 : 0);
    });
  }
  const mixedTrips = await validate(t, {
    'trips.txt': trips.replace('t,s', 'fixed,') + 'r,service,t,\n',
    'stop_times.txt': stopTimes + 'fixed,1,1,1\nfixed,2,,\n',
    'shapes.txt': null,
  });
  assert.equal(mixedTrips.samples.length, 2);
  assert.deepEqual(
    mixedTrips.samples.map(({ details }) => details?.tripId),
    ['t', 't'],
  );
});

test('unrelated routes and invalid enum values do not create shape requirements', async (t) => {
  const result = await validate(t, {
    'routes.txt': 'route_id,route_type,continuous_pickup\nr,3,1\nunused,3,0\n',
    'shapes.txt': null,
  });
  assert.deepEqual(result.samples, []);
  const invalid = await validate(t, {
    'routes.txt': 'route_id,route_type,continuous_pickup\nr,3,9\n',
    'shapes.txt': null,
  });
  assert.deepEqual(invalid.countsByCode, {
    [GtfsValidationNoticeCode.RANGE]: 1,
  });
});

test('partial imports skip the cross-file rule when a dependency is explicitly excluded', async (t) => {
  for (const filename of [
    'shapes.txt',
    'trips.txt',
    'routes.txt',
    'stop_times.txt',
  ]) {
    const result = await validate(
      t,
      { 'shapes.txt': null, 'trips.txt': trips.replace('t,s', 't,') },
      'strict',
      [filename],
    );
    assert.equal(result.valid, true, filename);
    assert.deepEqual(result.samples, [], filename);
  }
});

test('reports a missing shapes file only once across multiple affected trips', async (t) => {
  const result = await validate(t, {
    'trips.txt': trips + 'r,service,second,s\n',
    'stop_times.txt': stopTimes + 'second,1,,\nsecond,2,,\n',
    'shapes.txt': null,
  });
  assert.equal(result.samples.length, 1);
});

test('missing stop times do not hide a route-level geometry requirement', async (t) => {
  const result = await validate(t, {
    'stop_times.txt': null,
    'shapes.txt': null,
  });
  assert.deepEqual(
    result.samples.map(({ code, filename, severity }) => ({
      code,
      filename,
      severity,
    })),
    [
      {
        code: GtfsValidationNoticeCode.REQUIRED_FILE_MISSING,
        filename: 'stop_times.txt',
        severity: 'error',
      },
      {
        code: GtfsValidationNoticeCode.REQUIRED_FILE_MISSING,
        filename: 'shapes.txt',
        severity: 'error',
      },
    ],
  );
});

test('large trip sets use disk-backed segment summaries and bounded notice samples', async (t) => {
  const count = 3000;
  const directory = await createFeed(t, {
    'shapes.txt': null,
    'trips.txt':
      trips.split('\n')[0] +
      '\n' +
      Array.from({ length: count }, (_, i) => `r,service,t${i},\n`).join(''),
    'stop_times.txt':
      stopTimes.split('\n')[0] +
      '\n' +
      Array.from(
        { length: count },
        (_, i) => `t${i},30,,\nt${i},10,1,1\nt${i},20,0,1\n`,
      ).join(''),
  });
  let notices = 0;
  const staged = await stageGtfsSource({
    directory,
    tables,
    sourceId: 'large',
    mode: 'strict',
    onUnknownField: 'preserve',
    excludeFiles: ['calendar.txt', 'calendar_dates.txt'],
    onNotice() {
      notices += 1;
    },
  });
  try {
    assert.equal(staged.validation.shouldReject, true);
    assert.equal(notices, count + 1);
    assert.deepEqual(staged.validation.countsByCode, {
      [GtfsValidationNoticeCode.REQUIRED_FILE_MISSING]: 1,
      [GtfsValidationNoticeCode.CONDITIONAL_PRESENCE]: count,
    });
    assert.equal(staged.validation.samples.length, 100);
    assert.equal(staged.validation.truncated, true);
    const database = new Database(
      path.join(staged.directory, 'records.sqlite'),
      { readonly: true },
    );
    try {
      assert.equal(
        database
          .prepare('SELECT count(*) FROM continuous_trip_segments')
          .pluck()
          .get(),
        count,
      );
      assert.equal(
        database
          .prepare('SELECT count(*) FROM continuous_routes')
          .pluck()
          .get(),
        1,
      );
    } finally {
      database.close();
    }
  } finally {
    await staged.close();
  }
});

test('validation off creates no continuous-stop working tables', async (t) => {
  const directory = await createFeed(t, { 'shapes.txt': null });
  const staged = await stageGtfsSource({
    directory,
    tables,
    sourceId: 'off',
    mode: 'off',
    onUnknownField: 'preserve',
  });
  try {
    assert.deepEqual(staged.validation.samples, []);
    const database = new Database(
      path.join(staged.directory, 'records.sqlite'),
      { readonly: true },
    );
    try {
      assert.deepEqual(
        database
          .prepare(
            "SELECT name FROM sqlite_master WHERE name IN ('continuous_routes', 'continuous_trip_segments')",
          )
          .all(),
        [],
      );
    } finally {
      database.close();
    }
  } finally {
    await staged.close();
  }
});

for (const adapter of ['native', 'kysely'] as const) {
  test(`${adapter}: modes preserve rollback and source isolation for continuous-stop validation`, async (t) => {
    const complete = await createFeed(t);
    const broken = await createFeed(t, { 'shapes.txt': null });
    const sqlite = new Database(':memory:');
    const client =
      adapter === 'native'
        ? sqlite
        : new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });
    t.after(async () => {
      if (client instanceof Kysely) {
        await client.destroy();
      } else {
        client.close();
      }
    });
    const excludeFiles = Object.values(compiledTableRegistry).flatMap(
      ({ filename }) =>
        filename !== null &&
        !tables.some((table) => table.filename === filename)
          ? [filename]
          : [],
    );
    const run = (
      directory: string,
      mode: GtfsValidationMode,
      sourceId = 'test',
    ) =>
      importGtfs({
        database: { client },
        sources: [
          {
            sourceId,
            schedule: {
              path: directory,
              excludeFiles,
              import: { validation: { mode } },
            },
          },
        ],
        reporting: { level: 'silent' },
      });
    await run(complete, 'strict');
    await assert.rejects(run(broken, 'strict'), {
      code: GtfsErrorCode.VALIDATION_FAILED,
    });
    assert.equal(
      sqlite.prepare('SELECT count(*) FROM shapes').pluck().get(),
      2,
    );
    await assert.rejects(run(broken, 'strict', 'other'), {
      code: GtfsErrorCode.VALIDATION_FAILED,
    });
    const permissive = await run(broken, 'permissive');
    assert.equal(permissive.success, true);
    assert.deepEqual(permissive.validation.countsByCode, {
      [GtfsValidationNoticeCode.REQUIRED_FILE_MISSING]: 1,
    });
    assert.equal(
      sqlite.prepare('SELECT count(*) FROM shapes').pluck().get(),
      0,
    );
    const off = await run(broken, 'off');
    assert.equal(off.success, true);
    assert.deepEqual(off.validation.samples, []);
  });
}
