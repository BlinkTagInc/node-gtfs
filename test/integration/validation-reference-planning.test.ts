import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';

import { GtfsValidationNoticeCode } from '../../src/diagnostics/errors.ts';
import { stageGtfsSource } from '../../src/schedule/import/process-source.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';

function observeReferenceIndexWrites(t: TestContext) {
  const writes = new Map<string, number>();
  const prepare = Database.prototype.prepare;
  t.mock.method(
    Database.prototype,
    'prepare',
    function (this: Database.Database, sql: string) {
      const statement = prepare.call(this, sql);
      if (sql.startsWith('INSERT OR IGNORE INTO reference_values')) {
        const run = statement.run;
        t.mock.method(statement, 'run', (...values: unknown[]) => {
          const key = `${values[0]}.${values[1]}`;
          writes.set(key, (writes.get(key) ?? 0) + 1);
          return Reflect.apply(run, statement, values);
        });
      }
      return statement;
    },
  );
  return writes;
}

for (const translations of [
  'missing',
  'excluded',
  'included',
  'off',
] as const) {
  test(`reference indexes use only imported consumers: translations ${translations}`, async (t) => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'gtfs-reference-plan-'),
    );
    t.after(() => rm(directory, { recursive: true, force: true }));
    const fixtures = {
      'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\nstop,Stop,0,0\n',
      'trips.txt': 'route_id,service_id,trip_id\nroute,service,trip\n',
      'calendar_dates.txt':
        'service_id,date,exception_type\nservice,20260101,1\n',
      'stop_times.txt':
        'trip_id,arrival_time,departure_time,stop_id,stop_sequence\ntrip,09:00:00,09:00:00,stop,1\ntrip,10:00:00,10:00:00,stop,2\n',
    };
    for (const [filename, contents] of Object.entries(fixtures)) {
      await writeFile(path.join(directory, filename), contents);
    }
    if (translations !== 'missing') {
      await writeFile(
        path.join(directory, 'translations.txt'),
        'table_name,field_name,language,translation,record_id,record_sub_id\n' +
          'stop_times,stop_headsign,fr,First,trip,1\n' +
          'stop_times,stop_headsign,fr,Missing,trip,999\n' +
          'calendar_dates,service_id,fr,Service,service,20260101\n',
      );
    }
    const writes = observeReferenceIndexWrites(t);
    const staged = await stageGtfsSource({
      directory,
      sourceId: 'source',
      tables: [
        compiledTableRegistry.stopTimes,
        compiledTableRegistry.stops,
        compiledTableRegistry.trips,
        compiledTableRegistry.calendar,
        compiledTableRegistry.calendarDates,
        compiledTableRegistry.translations,
      ],
      mode: translations === 'off' ? 'off' : 'strict',
      onUnknownField: 'discard',
      excludeFiles: translations === 'excluded' ? ['translations.txt'] : [],
    });
    try {
      assert.deepEqual(
        [...writes].sort(),
        (translations === 'off'
          ? []
          : [
              ['stops.txt.stop_id', 1],
              ['trips.txt.trip_id', 1],
              ['calendar_dates.txt.service_id', 1],
              ...(translations === 'included'
                ? [
                    ['stop_times.txt.trip_id', 1],
                    ['stop_times.txt.stop_sequence', 2],
                    ['calendar_dates.txt.date', 1],
                  ]
                : []),
            ]
        ).sort(),
      );
      assert.equal(staged.validation.valid, true);
      assert.equal(staged.validation.shouldReject, false);
      assert.deepEqual(
        staged.validation.samples,
        translations === 'included'
          ? [
              {
                code: GtfsValidationNoticeCode.REFERENCE_NOT_FOUND,
                severity: 'warn',
                filename: 'translations.txt',
                sourceId: 'source',
                field: 'record_sub_id',
                position: { kind: 'csv', recordNumber: 2, csvLineNumber: 3 },
                message:
                  'translations.txt CSV record 2 (ending at line 3) references missing stop_times.txt.stop_sequence',
                details: {
                  value: '999',
                  targetFilename: 'stop_times.txt',
                  targetField: 'stop_sequence',
                  relationship: 'polymorphic',
                },
              },
            ]
          : [],
      );
      staged.assertNormalized();
      assert.deepEqual(
        [...staged.batches(compiledTableRegistry.stopTimes, 1, 2)].flatMap(
          ({ records }) =>
            records.map(({ row }) => [row.trip_id, row.stop_sequence]),
        ),
        [
          ['trip', 1],
          ['trip', 2],
        ],
      );
    } finally {
      await staged.close();
    }
  });
}

for (const excluded of [false, true]) {
  test(`missing required consumers do not request indexes; excluded=${excluded}`, async (t) => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'gtfs-missing-consumer-'),
    );
    t.after(() => rm(directory, { recursive: true, force: true }));
    await writeFile(
      path.join(directory, 'calendar_dates.txt'),
      'service_id,date,exception_type\nservice,20260101,1\n',
    );
    const writes = observeReferenceIndexWrites(t);
    const staged = await stageGtfsSource({
      directory,
      sourceId: 'source',
      tables: [
        compiledTableRegistry.trips,
        compiledTableRegistry.calendarDates,
      ],
      mode: 'strict',
      onUnknownField: 'discard',
      excludeFiles: excluded ? ['trips.txt'] : [],
    });
    try {
      assert.equal(writes.size, 0);
      assert.equal(staged.validation.valid, excluded);
      assert.equal(staged.validation.shouldReject, !excluded);
      assert.deepEqual(
        staged.validation.samples,
        excluded
          ? []
          : [
              {
                code: GtfsValidationNoticeCode.REQUIRED_FILE_MISSING,
                severity: 'error',
                filename: 'trips.txt',
                sourceId: 'source',
                message: 'Required GTFS file trips.txt is missing',
              },
            ],
      );
    } finally {
      await staged.close();
    }
  });
}
