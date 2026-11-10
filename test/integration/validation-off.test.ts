import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import { importGtfs } from '../../src/operations.ts';
import { stageGtfsSource } from '../../src/schedule/import/process-source.ts';
import { GtfsErrorCode, isGtfsError } from '../../src/diagnostics/errors.ts';
import { fileBackedTables } from '../../src/schema/table-registry.ts';
import type { GtfsDatabase } from '../../src/schema/database.ts';
import type { GtfsReportEvent } from '../../src/reporting/types.ts';
import type { GtfsScheduleValidationConfig } from '../../src/types/config.ts';

async function fixture(t: TestContext) {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-validation-off-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    path.join(directory, 'stops.txt'),
    'stop_id,stop_name,custom\n001,Original,extra\n',
  );
  return directory;
}

for (const adapter of ['native', 'kysely'] as const) {
  test(`${adapter}: validation defaults to off, retaining incomplete feeds, broken references and semantic conflicts`, async (t) => {
    const directory = await fixture(t);
    await writeFile(
      path.join(directory, 'trips.txt'),
      'route_id,service_id,trip_id\nmissing-route,missing-service,orphan\n',
    );
    await writeFile(
      path.join(directory, 'frequencies.txt'),
      'trip_id,start_time,end_time,headway_secs\norphan,23:00:00,22:00:00,60\n',
    );
    const database = new Database(':memory:');
    const portable =
      adapter === 'kysely'
        ? new Kysely<GtfsDatabase>({ dialect: new SqliteDialect({ database }) })
        : undefined;
    t.after(async () => {
      await portable?.destroy();
      if (database.open) {
        database.close();
      }
    });
    const events: GtfsReportEvent[] = [];
    const run = (validation?: GtfsScheduleValidationConfig) =>
      importGtfs({
        database: { client: portable ?? database },
        sources: [
          {
            schedule: {
              path: directory,
              import: validation === undefined ? {} : { validation },
            },
          },
        ],
        reporting: {
          level: 'info',
          reporter: (event) => {
            events.push(event);
          },
        },
      });
    const result = await run();
    assert.equal(result.success, true);
    assert.deepEqual(result.validation.samples, []);
    assert.deepEqual(
      database
        .prepare('SELECT stop_id, stop_name, _unknown_fields FROM stops')
        .all(),
      [
        {
          stop_id: '001',
          stop_name: 'Original',
          _unknown_fields: '{"custom":"extra"}',
        },
      ],
    );
    assert.deepEqual(
      database.prepare('SELECT route_id,service_id,trip_id FROM trips').all(),
      [
        {
          route_id: 'missing-route',
          service_id: 'missing-service',
          trip_id: 'orphan',
        },
      ],
    );
    assert.deepEqual(
      database.prepare('SELECT start_time,end_time FROM frequencies').all(),
      [{ start_time: '23:00:00', end_time: '22:00:00' }],
    );
    const messages = events.flatMap((event) =>
      event.type === 'status' ? [event.message] : [],
    );
    assert.equal(
      messages.filter((message) => message.includes('Validation off')).length,
      1,
    );
    assert.ok(
      messages.some((message) =>
        message.includes('sources[].schedule.import.validation.mode'),
      ),
    );
    assert.equal(messages.includes('Validated GTFS files'), false);
    events.length = 0;
    await assert.rejects(run({ mode: 'strict' }), {
      code: GtfsErrorCode.VALIDATION_FAILED,
    });
    assert.equal(
      events.some(
        (event) =>
          event.type === 'status' && event.message.includes('Validation off'),
      ),
      false,
    );
    assert.equal(
      database.prepare('SELECT stop_name FROM stops').pluck().get(),
      'Original',
    );

    // Storage failures must restore the source, not silently drop duplicate rows.
    await writeFile(
      path.join(directory, 'stops.txt'),
      'stop_id,stop_name\n001,First\n001,Second\n',
    );
    await assert.rejects(run({ mode: 'off' }), {
      code: GtfsErrorCode.DATABASE_OPERATION_FAILED,
    });
    assert.equal(
      database.prepare('SELECT stop_name FROM stops').pluck().get(),
      'Original',
    );
    const kept = await run({ mode: 'off', onDuplicateKey: 'keep-first' });
    assert.equal(
      database.prepare('SELECT stop_name FROM stops').pluck().get(),
      'First',
    );
    assert.equal(
      kept.validation.samples.filter(
        (notice) => notice.code === 'GTFS_DUPLICATE_PRIMARY_KEY',
      ).length,
      1,
    );

    await writeFile(
      path.join(directory, 'stops.txt'),
      'stop_id,stop_name,stop_lat\n002,Valid,0\n003,Invalid,not-a-number\n',
    );
    await assert.rejects(run(), (error) => {
      assert.ok(isGtfsError(error));
      assert.equal(error.code, GtfsErrorCode.INVALID_VALUE);
      assert.deepEqual(error.position, {
        kind: 'csv',
        recordNumber: 2,
        csvLineNumber: 3,
      });
      return true;
    });
    assert.deepEqual(
      database.prepare('SELECT stop_id,stop_name FROM stops').all(),
      [{ stop_id: '001', stop_name: 'First' }],
    );
  });
}

test('off staging does not populate validation reference or primary-key storage', async (t) => {
  const directory = await fixture(t);
  await writeFile(
    path.join(directory, 'trips.txt'),
    'route_id,service_id,trip_id\nmissing,missing,trip\n',
  );
  const staged = await stageGtfsSource({
    directory,
    tables: fileBackedTables,
    mode: 'off',
    onUnknownField: 'preserve',
    sourceId: 'test',
  });
  try {
    assert.deepEqual(staged.validation, {
      countsByCode: {},
      countsBySeverity: { error: 0, warn: 0, info: 0 },
      samples: [],
      truncated: false,
      valid: true,
      shouldReject: false,
    });
    const database = new Database(
      path.join(staged.directory, 'records.sqlite'),
      { readonly: true },
    );
    try {
      for (const table of [
        'record_keys',
        'reference_rows',
        'reference_values',
      ]) {
        assert.equal(
          database.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),
          0,
        );
      }
    } finally {
      database.close();
    }
  } finally {
    await staged.close();
  }
});

test('off switches unknown-field policies without changing the schema and preserves existing data on rejection', async (t) => {
  const directory = await fixture(t);
  const database = new Database(':memory:');
  t.after(() => database.close());
  const run = (onUnknownField: 'reject' | 'discard' | 'preserve') =>
    importGtfs({
      database: { client: database },
      sources: [
        {
          schedule: {
            path: directory,
            import: { validation: { onUnknownField } },
          },
        },
      ],
      reporting: { level: 'silent' },
    });
  await assert.rejects(run('reject'), {
    code: GtfsErrorCode.VALIDATION_FAILED,
  });
  const result = await run('discard');
  assert.equal(
    database.prepare('SELECT _unknown_fields FROM stops').pluck().get(),
    null,
  );
  assert.equal(result.validation.samples.length, 1);
  assert.match(
    result.validation.samples[0]?.message ?? '',
    /will be discarded/u,
  );
  const columns = database.prepare('PRAGMA table_info(stops)').all();
  assert.equal((await run('preserve')).success, true);
  assert.equal(
    database.prepare('SELECT _unknown_fields FROM stops').pluck().get(),
    '{"custom":"extra"}',
  );
  await assert.rejects(run('reject'), {
    code: GtfsErrorCode.VALIDATION_FAILED,
  });
  assert.equal(
    database.prepare('SELECT _unknown_fields FROM stops').pluck().get(),
    '{"custom":"extra"}',
  );
  assert.deepEqual(database.prepare('PRAGMA table_info(stops)').all(), columns);
  assert.equal((await run('discard')).success, true);
  assert.equal(
    database.prepare('SELECT _unknown_fields FROM stops').pluck().get(),
    null,
  );
  assert.deepEqual(database.prepare('PRAGMA table_info(stops)').all(), columns);
});

for (const scenario of [
  {
    name: 'missing storage-required value',
    csv: 'stop_name\nMissing identity\n',
    code: GtfsErrorCode.REQUIRED_VALUE_MISSING,
  },
  {
    name: 'malformed CSV',
    csv: 'stop_id,stop_name\n002,"Unclosed\n',
    code: GtfsErrorCode.CSV_PARSE_FAILED,
  },
  {
    name: 'database range constraint',
    csv: 'stop_id,stop_name,stop_lat\n002,Invalid latitude,91\n',
    code: GtfsErrorCode.DATABASE_OPERATION_FAILED,
  },
] as const) {
  test(`off reports ${scenario.name} without losing the existing source`, async (t) => {
    const directory = await fixture(t);
    const database = new Database(':memory:');
    t.after(() => database.close());
    const config = {
      database: { client: database },
      sources: [{ schedule: { path: directory } }],
      reporting: { level: 'silent' as const },
    };
    await importGtfs(config);
    await writeFile(path.join(directory, 'stops.txt'), scenario.csv);
    await assert.rejects(importGtfs(config), { code: scenario.code });
    assert.deepEqual(
      database.prepare('SELECT stop_id,stop_name FROM stops').all(),
      [{ stop_id: '001', stop_name: 'Original' }],
    );
  });
}
