import assert from 'node:assert/strict';
import { ReadStream, writeFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import Database from 'better-sqlite3';

import { compileTable } from '../../src/schema/compile-table.ts';
import { defineGtfsTable } from '../../src/schema/define-table.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import { stageGtfsSource } from '../../src/schedule/import/process-source.ts';
import {
  GtfsValidationNoticeCode,
  type GtfsValidationNotice,
} from '../../src/diagnostics/errors.ts';
import { importGtfs } from '../../src/operations.ts';

test('reference notice delivery remains complete while samples stay bounded across disk page boundaries', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-reference-pages-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    path.join(directory, 'stops.txt'),
    'stop_id,parent_station\n' +
      Array.from(
        { length: 2002 },
        (_, index) => `stop-${index},missing\n`,
      ).join(''),
  );
  let delivered = 0;
  const staged = await stageGtfsSource({
    sourceId: 'test',
    directory,
    tables: [compiledTableRegistry.stops],
    mode: 'strict',
    onUnknownField: 'discard',
    excludeFiles: ['calendar.txt', 'calendar_dates.txt'],
    onNotice(notice) {
      delivered += 1;
      assert.equal(notice.code, GtfsValidationNoticeCode.REFERENCE_NOT_FOUND);
      assert.equal(
        notice.position?.kind === 'csv' && notice.position.recordNumber,
        delivered,
      );
    },
  });
  t.after(() => staged.close());
  const result = staged.validation;
  assert.equal(result.valid, true);
  assert.equal(delivered, 2002);
  assert.equal(result.samples.length, 100);
  assert.equal(
    result.countsByCode[GtfsValidationNoticeCode.REFERENCE_NOT_FOUND],
    2002,
  );
  assert.equal(result.truncated, true);
  for (const [index, notice] of result.samples.entries()) {
    assert.equal(notice.code, GtfsValidationNoticeCode.REFERENCE_NOT_FOUND);
    assert.deepEqual(notice.position, {
      kind: 'csv',
      recordNumber: index + 1,
      csvLineNumber: index + 2,
    });
    assert.equal(notice.details?.value, 'missing');
  }
});

test('reference notices retain manifest file and field order after row-wise validation', async (t) => {
  const delivered: GtfsValidationNotice[] = [];
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-reference-order-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sources = [
    { filename: 'z_records.txt', recordCount: 2002 },
    { filename: 'a_records.txt', recordCount: 2 },
  ] as const;
  const tables = sources.map(({ filename }) => ({
    ...compileTable(
      defineGtfsTable({
        filename,
        tableName: filename.replace('.txt', ''),
        specification: 'gtfs-schedule',
        presence: 'optional',
        keyStrategy: 'columns',
        fields: {
          id: { kind: 'id' },
          z_id: {
            kind: 'id',
            references: [
              {
                targetFilename: filename,
                targetField: 'id',
                relationship: 'unambiguous',
              },
            ],
          },
          a_id: {
            kind: 'id',
            references: [
              {
                targetFilename: filename,
                targetField: 'id',
                relationship: 'unambiguous',
              },
            ],
          },
        },
      }),
    ),
    filename,
  }));
  for (const { filename, recordCount } of sources) {
    await writeFile(
      path.join(directory, filename),
      'id,z_id,a_id,unknown\n' +
        Array.from(
          { length: recordCount },
          (_, index) =>
            `id-${index},missing-z-${index},missing-a-${index},extra\n`,
        ).join(''),
    );
  }
  const staged = await stageGtfsSource({
    sourceId: 'test',
    directory,
    tables,
    mode: 'strict',
    onUnknownField: 'preserve',
    excludeFiles: ['calendar.txt', 'calendar_dates.txt'],
    onNotice: (notice) => delivered.push(notice),
  });
  t.after(() => staged.close());
  const result = staged.validation;
  assert.equal(result.valid, false);
  assert.equal(result.shouldReject, true);
  assert.deepEqual(
    delivered.map(({ code, filename, field, position, details }) => ({
      code,
      filename,
      field,
      position,
      value: details?.value,
    })),
    [
      ...sources.map(({ filename }) => ({
        code: GtfsValidationNoticeCode.UNKNOWN_FIELD,
        filename,
        field: 'unknown',
        position: undefined,
        value: undefined,
      })),
      ...sources.flatMap(({ filename, recordCount }) =>
        ['z_id', 'a_id'].flatMap((field) =>
          Array.from({ length: recordCount }, (_, index) => ({
            code: GtfsValidationNoticeCode.REFERENCE_NOT_FOUND,
            filename,
            field,
            position: {
              kind: 'csv',
              recordNumber: index + 1,
              csvLineNumber: index + 2,
            },
            value: `missing-${field[0]}-${index}`,
          })),
        ),
      ),
    ],
  );
});

test('GeoJSON duplicate notices identify features rather than CSV rows', async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'gtfs-feature-positions-'),
  );
  t.after(() => rm(directory, { recursive: true, force: true }));
  const feature = {
    type: 'Feature',
    id: 'same',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
  };
  await writeFile(
    path.join(directory, 'locations.geojson'),
    JSON.stringify({ type: 'FeatureCollection', features: [feature, feature] }),
  );
  const staged = await stageGtfsSource({
    sourceId: 'test',
    directory,
    tables: [compiledTableRegistry.locations],
    mode: 'strict',
    onUnknownField: 'discard',
    excludeFiles: ['calendar.txt', 'calendar_dates.txt'],
  });
  t.after(() => staged.close());
  const result = staged.validation;
  assert.equal(result.shouldReject, true);
  assert.deepEqual(result.samples, [
    {
      code: GtfsValidationNoticeCode.DUPLICATE_PRIMARY_KEY,
      severity: 'error',
      sourceId: 'test',
      message:
        'locations.geojson feature 2 duplicates a primary key from feature 1',
      filename: 'locations.geojson',
      position: { kind: 'geojson', featureNumber: 2 },
      firstPosition: { kind: 'geojson', featureNumber: 1 },
      details: { fields: ['id'] },
    },
  ]);
});

test('strict validation rejects before preparing any source deletion', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-strict-staging-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const database = new Database(':memory:');
  t.after(() => database.close());
  const filename = path.join(directory, 'stops.txt');
  await writeFile(filename, 'stop_id,stop_lat\nold,0\n');
  const config = {
    database: { client: database },
    reporting: { level: 'silent' as const },
    sources: [
      {
        sourceId: 'source',
        schedule: {
          path: directory,
          import: { validation: { mode: 'permissive' as const } },
        },
      },
    ],
  };
  await importGtfs(config);
  await writeFile(filename, 'stop_id,stop_lat\nnew,invalid\n');
  const statements: string[] = [];
  const prepare = database.prepare;
  t.mock.method(database, 'prepare', function (sql: string) {
    statements.push(sql);
    return prepare.call(database, sql);
  });
  await assert.rejects(
    importGtfs({
      ...config,
      sources: [
        {
          sourceId: 'source',
          schedule: {
            path: directory,
            import: { validation: { mode: 'strict' } },
          },
        },
      ],
    }),
    { code: 'GTFS_VALIDATION_FAILED' },
  );
  assert.deepEqual(
    statements.filter((sql) => /\bDELETE\b/i.test(sql)),
    [],
  );
  assert.deepEqual(
    database.prepare('SELECT stop_id, stop_lat FROM stops').all(),
    [{ stop_id: 'old', stop_lat: 0 }],
  );
});

const table = {
  ...compileTable(
    defineGtfsTable({
      filename: 'events.txt',
      tableName: 'events',
      specification: 'gtfs-schedule',
      presence: 'optional',
      keyStrategy: 'columns',
      primaryKey: ['id'],
      storageKey: ['source_id', 'id'],
      fields: {
        id: { kind: 'integer', presence: 'required' },
        time: { kind: 'time' },
        amount: {
          kind: 'real',
          monetary: {
            currencyField: 'currency',
            publicRepresentation: 'decimal-string',
            storageRepresentation: 'minor-units',
          },
        },
        currency: { kind: 'text', defaultValue: 'USD' },
      },
    }),
  ),
  filename: 'events.txt',
};

test('staging preserves typed values and positions, skips invalid rows, and deduplicates normalized keys on disk', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-staging-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    path.join(directory, table.filename),
    [
      'id,time,amount,currency,custom',
      '01,25:1:2,2.50,USD,"first\nline"',
      '2,invalid,3,USD,invalid',
      '1,09:00:00,99,USD,duplicate',
      '3,,92233720368547758.07,USD,last',
      '',
    ].join('\n'),
  );
  const staged = await stageGtfsSource({
    directory,
    tables: [table],
    sourceId: 'source',
    mode: 'permissive',
    onUnknownField: 'preserve',
    onDuplicateKey: 'keep-first',
    excludeFiles: ['calendar.txt', 'calendar_dates.txt'],
  });
  try {
    assert.equal(staged.validation.shouldReject, false);
    assert.equal(staged.validation.valid, false);
    assert.deepEqual(
      staged.validation.samples.filter(
        ({ code }) => code === GtfsValidationNoticeCode.DUPLICATE_PRIMARY_KEY,
      ),
      [
        {
          code: GtfsValidationNoticeCode.DUPLICATE_PRIMARY_KEY,
          severity: 'warn',
          filename: 'events.txt',
          sourceId: 'source',
          position: { kind: 'csv', recordNumber: 3, csvLineNumber: 5 },
          firstPosition: { kind: 'csv', recordNumber: 1, csvLineNumber: 3 },
          message:
            'events.txt CSV record 3 (ending at line 5) matches the normalized storage key from CSV record 1 (ending at line 3) and was skipped',
          details: {
            scope: 'normalized',
            fields: ['source_id', 'id'],
          },
        },
      ],
    );
    assert.deepEqual(
      staged.validation.samples.find(
        ({ code }) => code === GtfsValidationNoticeCode.INVALID_VALUE,
      )?.position,
      { kind: 'csv', recordNumber: 2, csvLineNumber: 4 },
    );
    staged.assertNormalized();
    assert.ok(
      (await stat(path.join(staged.directory, 'records.sqlite'))).size > 0,
    );
    await rm(path.join(directory, table.filename));
    const batches = [...staged.batches(table, 1, 4)];
    assert.deepEqual(
      batches.map(({ records }) => records.length),
      [1, 1],
    );
    assert.deepEqual(
      batches.flatMap(({ records }) => records),
      [
        {
          row: {
            source_id: 'source',
            id: 1,
            time: '25:01:02',
            time_service_day_seconds: 90062,
            amount: 250n,
            currency: 'USD',
            _unknown_fields: '{"custom":"first\\nline"}',
          },
          position: { kind: 'csv', recordNumber: 1, csvLineNumber: 3 },
        },
        {
          row: {
            source_id: 'source',
            id: 3,
            time: null,
            time_service_day_seconds: null,
            amount: 9223372036854775807n,
            currency: 'USD',
            _unknown_fields: '{"custom":"last"}',
          },
          position: { kind: 'csv', recordNumber: 4, csvLineNumber: 6 },
        },
      ],
    );
    assert.equal(Object.isFrozen(batches[0]?.records[0]?.row), true);
  } finally {
    await staged.close();
  }
  await staged.close();
  await assert.rejects(stat(staged.directory), { code: 'ENOENT' });
});

for (const mode of ['off', 'strict', 'permissive'] as const) {
  test(`${mode} staging distinguishes raw and normalized duplicate keys without double-reporting a skipped row`, async (t) => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'gtfs-staged-duplicates-'),
    );
    t.after(() => rm(directory, { recursive: true, force: true }));
    await writeFile(
      path.join(directory, table.filename),
      'id,time\n01,09:00:00\n1,10:00:00\n1,11:00:00\n',
    );
    const staged = await stageGtfsSource({
      directory,
      tables: [table],
      sourceId: 'source',
      mode,
      onUnknownField: 'discard',
      onDuplicateKey: 'keep-first',
      excludeFiles: ['calendar.txt', 'calendar_dates.txt'],
    });
    try {
      assert.equal(staged.validation.valid, true);
      assert.equal(staged.validation.shouldReject, false);
      const notices = staged.validation.samples;
      assert.equal(notices.length, 2);
      assert.deepEqual(
        notices.map(({ position, details, firstPosition, severity }) => [
          position,
          details?.scope,
          firstPosition,
          severity,
        ]),
        [
          [
            { kind: 'csv', recordNumber: 2, csvLineNumber: 3 },
            'normalized',
            { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
            'warn',
          ],
          mode === 'off'
            ? [
                { kind: 'csv', recordNumber: 3, csvLineNumber: 4 },
                'normalized',
                { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
                'warn',
              ]
            : [
                { kind: 'csv', recordNumber: 3, csvLineNumber: 4 },
                undefined,
                { kind: 'csv', recordNumber: 2, csvLineNumber: 3 },
                'warn',
              ],
        ],
      );
      const records = [...staged.batches(table, 1, 3)].flatMap(
        (batch) => batch.records,
      );
      assert.equal(records.length, 1);
      assert.equal(records[0]?.row.time, '09:00:00');
    } finally {
      await staged.close();
    }
  });
}

test('temporary validation stores close and are removed on success, strict rejection, parser failure, and staging write failure', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-staging-cleanup-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const closed: string[] = [];
  const close = Database.prototype.close;
  t.mock.method(
    Database.prototype,
    'close',
    function (this: Database.Database) {
      if (path.basename(this.name) === 'records.sqlite') {
        closed.push(path.dirname(this.name));
      }
      return close.call(this);
    },
  );
  for (const contents of [
    'id,time\n1,09:00:00\n',
    'id,time\n1,invalid\n',
    'id,time\n1,"unterminated',
  ]) {
    await writeFile(path.join(directory, table.filename), contents);
    const options = {
      sourceId: 'test',
      directory,
      tables: [table],
      mode: 'strict' as const,
      onUnknownField: 'discard' as const,
      excludeFiles: ['calendar.txt', 'calendar_dates.txt'],
    };
    if (contents.includes('unterminated')) {
      await assert.rejects(stageGtfsSource(options), {
        code: 'GTFS_CSV_PARSE_FAILED',
      });
    } else {
      const staged = await stageGtfsSource(options);
      try {
        assert.equal(
          staged.validation.shouldReject,
          contents.includes('invalid'),
        );
      } finally {
        await staged.close();
      }
    }
  }
  await writeFile(
    path.join(directory, table.filename),
    'id,time\n1,09:00:00\n',
  );
  const prepare = Database.prototype.prepare;
  t.mock.method(
    Database.prototype,
    'prepare',
    function (this: Database.Database, sql: string) {
      if (sql.startsWith('INSERT INTO records')) {
        throw new Error('Staging disk unavailable');
      }
      return prepare.call(this, sql);
    },
  );
  await assert.rejects(
    stageGtfsSource({
      directory,
      tables: [table],
      sourceId: 'source',
      mode: 'strict',
      onUnknownField: 'discard',
    }),
    /Staging disk unavailable/,
  );
  assert.equal(closed.length, 4);
  for (const temporaryDirectory of closed) {
    await assert.rejects(stat(temporaryDirectory), { code: 'ENOENT' });
  }
});

for (const { label, recordCount, failAt, insertPrefix } of [
  {
    label: 'final partial',
    recordCount: 10,
    failAt: 1,
    insertPrefix: 'INSERT INTO records VALUES',
  },
  {
    label: 'intermediate',
    recordCount: 4097,
    failAt: 2,
    insertPrefix: 'INSERT INTO records VALUES',
  },
  {
    label: 'duplicate-key',
    recordCount: 10,
    failAt: 2,
    insertPrefix: 'INSERT INTO record_keys VALUES',
  },
]) {
  test(`${label} staging write failure preserves the existing source and removes working storage`, async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-chunk-failure-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const database = new Database(':memory:');
    t.after(() => database.close());
    const filename = path.join(directory, 'stops.txt');
    await writeFile(filename, 'stop_id,stop_name\nold,Original\n');
    const config = {
      database: { client: database },
      sources: [
        {
          sourceId: 'source',
          schedule: {
            path: directory,
            import: { validation: { mode: 'permissive' as const } },
          },
        },
      ],
      reporting: { level: 'silent' as const },
    };
    await importGtfs(config);
    await writeFile(
      filename,
      'stop_id,stop_name\n' +
        Array.from(
          { length: recordCount },
          (_, index) => `new-${index},New\n`,
        ).join(''),
    );
    let writes = 0;
    const writeFailure = new Error('Staging write failed');
    const temporaryDirectories = new Set<string>();
    const deletions: string[] = [];
    const prepare = Database.prototype.prepare;
    t.mock.method(
      Database.prototype,
      'prepare',
      function (this: Database.Database, sql: string) {
        const statement = prepare.call(this, sql);
        if (this === database && /\bDELETE\b/i.test(sql)) {
          deletions.push(sql);
        }
        if (
          path.basename(this.name) === 'records.sqlite' &&
          sql.startsWith(insertPrefix)
        ) {
          temporaryDirectories.add(path.dirname(this.name));
          const run = statement.run;
          t.mock.method(statement, 'run', (...args: unknown[]) => {
            writes += 1;
            if (writes === failAt) {
              throw writeFailure;
            }
            return Reflect.apply(run, statement, args);
          });
        }
        return statement;
      },
    );
    await assert.rejects(importGtfs(config), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.cause, writeFailure);
      return true;
    });
    assert.equal(writes, failAt);
    assert.deepEqual(deletions, []);
    assert.deepEqual(
      database.prepare('SELECT stop_id, stop_name FROM stops').all(),
      [{ stop_id: 'old', stop_name: 'Original' }],
    );
    assert.equal(temporaryDirectories.size, 1);
    for (const temporaryDirectory of temporaryDirectories) {
      await assert.rejects(stat(temporaryDirectory), { code: 'ENOENT' });
    }
  });
}

test('an import reads each CSV file once and retains staged values after the file changes', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-single-pass-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const database = new Database(':memory:');
  t.after(() => database.close());
  await writeFile(
    path.join(directory, 'agency.txt'),
    'agency_name,agency_url,agency_timezone\nAgency,https://example.com,Etc/UTC\n',
  );
  await writeFile(
    path.join(directory, 'stops.txt'),
    'stop_id,stop_name\nstop,Original\n',
  );
  const streamsByFile = new Map<string, Set<ReadStream>>();
  const read = ReadStream.prototype._read;
  t.mock.method(
    ReadStream.prototype,
    '_read',
    function (this: ReadStream, size: number) {
      const filePath = String(this.path);
      if (['agency.txt', 'stops.txt'].includes(path.basename(filePath))) {
        const streams = streamsByFile.get(filePath) ?? new Set<ReadStream>();
        if (!streams.has(this) && path.basename(filePath) === 'stops.txt') {
          this.once('end', () =>
            writeFileSync(
              filePath,
              'stop_id,stop_name\nstop,Changed on disk\n',
            ),
          );
        }
        streams.add(this);
        streamsByFile.set(filePath, streams);
      }
      read.call(this, size);
    },
  );
  await importGtfs({
    database: { client: database },
    reporting: { level: 'silent' },
    sources: [
      {
        schedule: {
          path: directory,
          import: {
            validation: { mode: 'permissive' },
          },
        },
      },
    ],
  });
  assert.deepEqual(
    [...streamsByFile]
      .map(([filePath, streams]) => [path.basename(filePath), streams.size])
      .sort(),
    [
      ['agency.txt', 1],
      ['stops.txt', 1],
    ],
  );
  assert.equal(
    database.prepare('SELECT stop_name FROM stops').pluck().get(),
    'Original',
  );
});

test(
  'large CSV staging and 50,000 detailed notices complete with a 96 MiB JavaScript heap',
  { timeout: 60_000 },
  async (t) => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'gtfs-staging-memory-'),
    );
    t.after(() => rm(directory, { recursive: true, force: true }));
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        '--max-old-space-size=96',
        '--disable-warning=ExperimentalWarning',
        'test/helpers/streaming-validation-memory.ts',
        directory,
      ],
      { timeout: 55_000, maxBuffer: 1024 * 1024 },
    );
    assert.equal(stdout.trim(), 'Validated and replayed 50000 records');
    assert.deepEqual(await readdir(directory), []);
  },
);
