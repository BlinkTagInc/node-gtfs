import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { createGtfsWorkingBatches } from '../../src/schedule/import/staging/batches.ts';
import { createGtfsValidationKeyStore } from '../../src/schedule/import/staging/key-store.ts';
import { createGtfsValidationReferenceStore } from '../../src/schedule/import/staging/reference-store.ts';
import { createGtfsWorkingStore } from '../../src/schedule/import/staging/store.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import type {
  GtfsCsvSourcePosition,
  GtfsGeoJSONSourcePosition,
  GtfsSourcePosition,
} from '../../src/diagnostics/position.ts';
import type { NormalizedImportRecord } from '../../src/schedule/import/records.ts';

test('working batches preserve types, gaps, file isolation, and repeatable abandoned reads', (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  const batches = createGtfsWorkingBatches<
    { id: number; amount: bigint; text: string | null },
    GtfsCsvSourcePosition
  >(database, 'records');
  const values = Array.from({ length: 2051 }, (_, id) => ({
    position: {
      kind: 'csv' as const,
      recordNumber: id * 2 + 1,
      csvLineNumber: id * 3 + 2,
    },
    row: {
      id,
      amount: 9223372036854775807n,
      text: id % 2 === 0 ? '\u0000é\n"' : null,
    },
  }));
  const [first, second] = values;
  assert.ok(first);
  assert.ok(second);
  for (const [index, record] of values.entries()) {
    batches.append('first.txt', index * 2 + 1, record);
  }
  batches.append('other.txt', 1, first);
  assert.deepEqual([...batches.records('absent.txt')], []);
  const abandoned = batches.records('first.txt');
  assert.deepEqual(abandoned.next().value, values[0]);
  abandoned.return(undefined);
  batches.append('other.txt', 5, second);
  assert.deepEqual([...batches.records('first.txt')], values);
  assert.deepEqual([...batches.records('other.txt')], values.slice(0, 2));
  assert.deepEqual([...batches.records('first.txt')], values);
  assert.equal(
    database
      .prepare("SELECT count(*) FROM records WHERE filename = 'first.txt'")
      .pluck()
      .get(),
    3,
  );
  assert.throws(
    () => batches.append('first.txt', 1, first),
    /ordinals must increase/,
  );
});

test('working batches reconstruct only row and position from decorated records', (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  const batches = createGtfsWorkingBatches<
    { id: string },
    GtfsCsvSourcePosition
  >(database, 'records');
  const record = {
    row: { id: 'one' },
    position: { kind: 'csv' as const, recordNumber: 3, csvLineNumber: 5 },
    label: 'not persisted',
  };
  batches.append('rows.txt', 1, record);
  assert.deepEqual(
    [...batches.records('rows.txt')],
    [{ row: record.row, position: record.position }],
  );
});

test('working batches flush large values before the record-count limit', (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  const batches = createGtfsWorkingBatches<
    { text: string },
    GtfsGeoJSONSourcePosition
  >(database, 'records');
  const large = {
    row: { text: 'é'.repeat(600_000) },
    position: { kind: 'geojson' as const, featureNumber: 10 },
  };
  for (let ordinal = 1; ordinal <= 4; ordinal += 1) {
    batches.append('large.txt', ordinal, large);
  }
  batches.flush();
  assert.equal(
    database.prepare('SELECT count(*) FROM records').pluck().get(),
    4,
  );
  assert.deepEqual(
    [...batches.records('large.txt')],
    [large, large, large, large],
  );
});

test('working batches flush before their estimated byte limit even when values compress well', (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  const batches = createGtfsWorkingBatches(database, 'records');
  const records: NormalizedImportRecord[] = Array.from(
    { length: 5 },
    (_, index) => ({
      row: { text: 'é'.repeat(200_000) },
      position: { kind: 'geojson', featureNumber: index + 1 },
    }),
  );
  for (const [index, record] of records.entries()) {
    batches.append('large.geojson', index + 1, record);
  }
  batches.flush();
  assert.deepEqual(
    database
      .prepare('SELECT ordinal FROM records ORDER BY ordinal')
      .pluck()
      .all(),
    [2, 4, 5],
  );
  assert.deepEqual([...batches.records('large.geojson')], records);
});

test('compact chunks preserve changing field layouts, position kinds, and scalar values', (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  const batches = createGtfsWorkingBatches(database, 'records');
  const records: NormalizedImportRecord[] = [
    {
      row: { id: '001', value: null, amount: 9223372036854775807n },
      position: { kind: 'csv', recordNumber: 3, csvLineNumber: 9 },
    },
    {
      row: { value: '', amount: -9223372036854775808n, id: '002' },
      position: { kind: 'csv', recordNumber: 7, csvLineNumber: 15 },
    },
    {
      row: { id: '003', text: '  café,"quoted"\r\n\0', negativeZero: -0 },
      position: { kind: 'geojson', featureNumber: 21 },
    },
    { row: {}, position: { kind: 'realtime', entityNumber: 35 } },
    {
      row: Object.fromEntries([
        ['__proto__', 'own value'],
        ['constructor', 'data'],
      ]),
      position: { kind: 'geojson', featureNumber: 40 },
    },
    {
      row: { id: 'last' },
      position: { kind: 'csv', recordNumber: 80, csvLineNumber: 100 },
    },
  ];
  for (const [index, record] of records.entries()) {
    batches.append('mixed.txt', index + 1, record);
  }
  const replayed = [...batches.records('mixed.txt')];
  assert.deepEqual(replayed, records);
  assert.equal(Object.getPrototypeOf(replayed[4]?.row), Object.prototype);
  assert.equal(Object.hasOwn(replayed[4]?.row ?? {}, '__proto__'), true);
  assert.deepEqual([...batches.records('mixed.txt')], records);
});

test(
  'wide replay batches fit within a 64 MiB heap without oversized row representations',
  { timeout: 30_000 },
  async () => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        '--max-old-space-size=64',
        '--disable-warning=ExperimentalWarning',
        'test/helpers/working-batch-memory.ts',
      ],
      { timeout: 25_000 },
    );
    assert.match(stdout, /Replayed 40000 wide records/);
  },
);

test('key registration inserts once per unique key and reads positions only for duplicates', (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  let inserts = 0;
  let lookups = 0;
  const prepare = database.prepare;
  t.mock.method(database, 'prepare', function (sql: string) {
    const statement = prepare.call(database, sql);
    const method = sql.startsWith('INSERT') ? 'run' : 'get';
    const operation = statement[method];
    t.mock.method(statement, method, (...args: unknown[]) => {
      if (method === 'run') {
        inserts += 1;
      } else {
        lookups += 1;
      }
      return Reflect.apply(operation, statement, args);
    });
    return statement;
  });
  const tracker = createGtfsValidationKeyStore(database);
  const keys = tracker('stops.txt', 'primary');
  assert.equal(tracker('stops.txt', 'primary'), keys);
  const positions: GtfsSourcePosition[] = [
    { kind: 'csv', recordNumber: 3, csvLineNumber: 7 },
    { kind: 'geojson', featureNumber: 999 },
    { kind: 'realtime', entityNumber: 12 },
  ];
  for (const position of positions) {
    assert.equal(keys.register(position.kind, position), undefined);
  }
  assert.equal(inserts, 3);
  assert.equal(lookups, 0);
  for (const position of positions) {
    assert.deepEqual(
      tracker('stops.txt', 'primary').register(position.kind, {
        kind: 'csv',
        recordNumber: 10000,
        csvLineNumber: 10002,
      }),
      position,
    );
    assert.equal(
      tracker('levels.txt', 'primary').register(position.kind, position),
      undefined,
    );
    assert.equal(
      tracker('stops.txt', 'storage').register(position.kind, position),
      undefined,
    );
  }
  assert.equal(lookups, 3);
  assert.deepEqual(
    database
      .prepare(
        'SELECT DISTINCT typeof(scope_id) AS scope_type, typeof(kind) AS kind_type FROM record_keys',
      )
      .all(),
    [{ scope_type: 'integer', kind_type: 'integer' }],
  );
});

test('compact key scopes preserve exact keys and original positions across interleaved files', (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  const trackers = createGtfsValidationKeyStore(database);
  const filenames = [
    'stops.txt',
    'levels.txt',
    "quoted'name.txt",
    'file\0name',
  ];
  const keys = ['', '001', '1', 'A', 'a', 'é', 'e\u0301', 'nul\0value', 'nul'];
  const positions: GtfsSourcePosition[] = [
    { kind: 'csv', recordNumber: 10, csvLineNumber: Number.MAX_SAFE_INTEGER },
    { kind: 'geojson', featureNumber: Number.MAX_SAFE_INTEGER },
    { kind: 'realtime', entityNumber: Number.MAX_SAFE_INTEGER },
  ];
  const scopes = ['primary', 'storage'] as const;
  for (const [index, key] of keys.entries()) {
    const position = positions[index % positions.length];
    assert.ok(position);
    for (const filename of filenames) {
      for (const scope of scopes) {
        assert.equal(
          trackers(filename, scope).register(key, position),
          undefined,
        );
      }
    }
  }
  for (const [index, key] of keys.entries()) {
    for (const filename of filenames.toReversed()) {
      for (const scope of scopes.toReversed()) {
        assert.deepEqual(
          trackers(filename, scope).register(key, {
            kind: 'realtime',
            entityNumber: 1,
          }),
          positions[index % positions.length],
        );
      }
    }
  }
  assert.equal(
    database
      .prepare('SELECT count(DISTINCT scope_id) FROM record_keys')
      .pluck()
      .get(),
    filenames.length * scopes.length,
  );
  assert.equal(
    database.prepare('SELECT count(*) FROM record_keys').pluck().get(),
    filenames.length * scopes.length * keys.length,
  );
});

test('compact key tracking propagates write failures and does not treat invalid positions as new keys', (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  const keys = createGtfsValidationKeyStore(database)('stops.txt', 'primary');
  const position = { kind: 'csv' as const, recordNumber: 1, csvLineNumber: 2 };
  keys.register('first', position);
  database.exec(`CREATE TRIGGER fail_key BEFORE INSERT ON record_keys
    WHEN NEW.key = 'failure' BEGIN SELECT RAISE(ABORT, 'key write failed'); END;`);
  assert.throws(() => keys.register('failure', position), /key write failed/);
  assert.deepEqual(keys.register('first', position), position);
  assert.equal(keys.register('another', position), undefined);
  database.exec("UPDATE record_keys SET kind = 99 WHERE key = 'first'");
  assert.throws(
    () => keys.register('first', position),
    /Invalid staged duplicate-key position kind/,
  );
});

test('reference cache bounds repeated database calls and updates cached misses after insertion', (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  const references = createGtfsValidationReferenceStore(database);
  assert.equal(references.has('stops.txt', 'stop_id', 'stop'), false);
  references.add('stops.txt', 'stop_id', 'stop');
  assert.equal(references.has('stops.txt', 'stop_id', 'stop'), true);
  assert.equal(references.has('stops.txt', 'zone_id', 'stop'), false);
  assert.equal(references.has('trips.txt', 'trip_id', 'stop'), false);
  // Enough distinct values to evict early entries; SQLite remains authoritative.
  for (let index = 0; index < 40_000; index += 1) {
    references.add('trips.txt', 'trip_id', String(index));
  }
  assert.equal(references.has('stops.txt', 'stop_id', 'stop'), true);
  assert.equal(references.has('stops.txt', 'zone_id', 'stop'), false);
  for (let index = 0; index < 40_000; index += 1) {
    assert.equal(references.has('trips.txt', 'trip_id', String(index)), true);
  }
  references.add('stops.txt', 'stop_id', 'nul\0value');
  assert.equal(references.has('stops.txt', 'stop_id', 'nul\0value'), true);
});

test('reference cache handles byte-limit eviction, oversized values, and repeated hits and misses', (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  let writes = 0;
  let reads = 0;
  const prepare = database.prepare;
  t.mock.method(database, 'prepare', function (sql: string) {
    const statement = prepare.call(database, sql);
    const method = sql.startsWith('INSERT') ? 'run' : 'get';
    const operation = statement[method];
    t.mock.method(statement, method, (...args: unknown[]) => {
      if (method === 'run') {
        writes += 1;
      } else {
        reads += 1;
      }
      return Reflect.apply(operation, statement, args);
    });
    return statement;
  });
  const references = createGtfsValidationReferenceStore(database);
  for (let index = 0; index < 1000; index += 1) {
    references.add('stops.txt', 'stop_id', 'same');
    assert.equal(references.has('stops.txt', 'stop_id', 'same'), true);
    assert.equal(references.has('stops.txt', 'stop_id', 'missing'), false);
  }
  assert.equal(writes, 1);
  assert.equal(reads, 1);
  const long = 'x'.repeat(100_000);
  for (let index = 0; index < 100; index += 1) {
    references.add('stops.txt', 'stop_id', `${index}${long}`);
  }
  assert.equal(references.has('stops.txt', 'stop_id', 'same'), true);
  assert.equal(reads, 2);
  const oversized = 'x'.repeat(3_000_000);
  references.add('stops.txt', 'stop_id', oversized);
  for (let index = 0; index < 2; index += 1) {
    assert.equal(references.has('stops.txt', 'stop_id', oversized), true);
  }
  assert.equal(reads, 4);
});

test('keep-first duplicates cross working chunks and retain the first original position', async () => {
  const store = await createGtfsWorkingStore();
  try {
    const table = compiledTableRegistry.stops;
    const write = store.recordWriter({ table, keepFirst: true });
    for (let index = 1; index <= 2050; index += 1) {
      assert.equal(
        write(index, {
          row: { source_id: 'source', stop_id: String(index) },
          position: {
            kind: 'csv',
            recordNumber: index * 2,
            csvLineNumber: index * 3,
          },
        }),
        undefined,
      );
    }
    assert.deepEqual(
      write(3000, {
        row: { source_id: 'source', stop_id: '1', stop_name: 'discard' },
        position: { kind: 'csv', recordNumber: 6000, csvLineNumber: 9000 },
      }),
      { firstPosition: { kind: 'csv', recordNumber: 2, csvLineNumber: 3 } },
    );
    store.finish();
    const batches = [...store.batches(table, 777, 6000)];
    assert.deepEqual(
      batches.map(({ records }) => records.length),
      [777, 777, 496],
    );
    assert.equal(batches.at(-1)?.totalRecordCount, 6000);
    assert.equal(batches[0]?.records[0]?.row.stop_name, undefined);
    assert.deepEqual(batches.at(-1)?.records.at(-1)?.position, {
      kind: 'csv',
      recordNumber: 4100,
      csvLineNumber: 6150,
    });
  } finally {
    await store.close();
  }
});
