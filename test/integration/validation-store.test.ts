import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';

import { createGtfsWorkingStore } from '../../src/schedule/import/staging/store.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import type { NormalizedImportRecord } from '../../src/schedule/import/records.ts';

test('default staging stores bounded chunks without populating keep-first keys', async () => {
  const store = await createGtfsWorkingStore();
  try {
    const table = compiledTableRegistry.stops;
    const write = store.recordWriter({ table, keepFirst: false });
    for (let ordinal = 1; ordinal <= 5000; ordinal += 1) {
      assert.equal(
        write(ordinal, {
          row: { source_id: 'source', stop_id: 'same' },
          position: {
            kind: 'csv',
            recordNumber: ordinal,
            csvLineNumber: ordinal + 1,
          },
        }),
        undefined,
      );
    }
    store.finish();
    const database = new Database(
      path.join(store.directory, 'records.sqlite'),
      { readonly: true },
    );
    try {
      assert.equal(
        database.prepare('SELECT count(*) FROM record_keys').pluck().get(),
        0,
        'Unkeyed records must not consume duplicate-index entries',
      );
      assert.equal(
        database.prepare('SELECT count(*) FROM records').pluck().get(),
        5,
      );
    } finally {
      database.close();
    }
    const batches = [...store.batches(table, 999, 5000)];
    assert.deepEqual(
      batches.map(({ records }) => records.length),
      [999, 999, 999, 999, 999, 5],
    );
    assert.deepEqual(batches.at(-1)?.records.at(-1)?.position, {
      kind: 'csv',
      recordNumber: 5000,
      csvLineNumber: 5001,
    });
  } finally {
    await store.close();
  }
});

test('keep-first staging preserves null-containing keys, first positions, and ordinal constraints', async () => {
  const store = await createGtfsWorkingStore();
  try {
    const table = compiledTableRegistry.fareProducts;
    const write = store.recordWriter({ table, keepFirst: true });
    const first: NormalizedImportRecord = {
      row: {
        source_id: 'source',
        fare_product_id: 'fare',
        rider_category_id: null,
        fare_media_id: null,
        amount: 250n,
        currency: 'USD',
      },
      position: { kind: 'csv', recordNumber: 3, csvLineNumber: 6 },
    };
    assert.equal(write(3, first), undefined);
    const duplicate = {
      row: { ...first.row, amount: 999n },
      position: {
        kind: 'csv' as const,
        recordNumber: 1003,
        csvLineNumber: 1006,
      },
    };
    assert.deepEqual(write(1003, duplicate), { firstPosition: first.position });
    const anotherWriter = store.recordWriter({ table, keepFirst: true });
    assert.deepEqual(anotherWriter(1004, duplicate), {
      firstPosition: first.position,
    });
    const second = {
      ...duplicate,
      row: { ...duplicate.row, fare_media_id: 'card' },
    };
    assert.throws(() => write(3, second), /record ordinals must increase/u);
    assert.equal(write(1003, second), undefined);
    store.finish();
    const database = new Database(
      path.join(store.directory, 'records.sqlite'),
      { readonly: true },
    );
    try {
      assert.equal(
        database.prepare('SELECT count(*) FROM record_keys').pluck().get(),
        2,
      );
      const plan = database
        .prepare(
          'EXPLAIN QUERY PLAN SELECT record_number FROM record_keys WHERE scope_id = ? AND key = ?',
        )
        .all(1, 'key') as { detail: string }[];
      assert.ok(
        plan.some(({ detail }) => detail.includes('USING PRIMARY KEY')),
      );
    } finally {
      database.close();
    }
    assert.deepEqual(
      [...store.batches(table, 1, 1003)].flatMap(({ records }) => records),
      [first, second],
    );
  } finally {
    await store.close();
  }
});

test('staged duplicate keys remain isolated by filename', async () => {
  const store = await createGtfsWorkingStore();
  try {
    const stops = compiledTableRegistry.stops;
    const levels = compiledTableRegistry.levels;
    const position = {
      kind: 'csv' as const,
      recordNumber: 1,
      csvLineNumber: 2,
    };
    const stop = { row: { source_id: 'source', stop_id: 'same' }, position };
    const level = {
      row: { source_id: 'source', level_id: 'same', level_index: 0 },
      position,
    };
    assert.equal(
      store.recordWriter({ table: stops, keepFirst: true })(1, stop),
      undefined,
    );
    assert.equal(
      store.recordWriter({ table: levels, keepFirst: true })(1, level),
      undefined,
    );
    store.finish();
    assert.deepEqual(
      [...store.batches(stops, 1, 1)].flatMap(({ records }) => records),
      [stop],
    );
    assert.deepEqual(
      [...store.batches(levels, 1, 1)].flatMap(({ records }) => records),
      [level],
    );
  } finally {
    await store.close();
  }
});
