import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Kysely } from 'kysely';
import Database from 'better-sqlite3';
import type { GtfsDatabase } from '../../src/schema/index.ts';
import { verifyAggregateAndFieldReferenceIntegration } from '../contracts/cases/repository-aggregate.ts';
import { createDummyDialect } from '../helpers/kysely-dialect.ts';
import {
  integerText,
  nullableNumber,
  representativeTrips,
  safeInteger,
  serviceTime,
} from '../helpers/advanced-summary-recipes.ts';

test('advanced summary recipes execute with the native SQLite adapter', async () => {
  const client = new Database(':memory:');
  try {
    await verifyAggregateAndFieldReferenceIntegration({ client });
  } finally {
    client.close();
  }
});

test('SQL summary conversions preserve nulls and reject lossy integers', () => {
  for (const value of [
    0,
    '0',
    0n,
    Number.MAX_SAFE_INTEGER,
    String(Number.MAX_SAFE_INTEGER),
  ]) {
    assert.equal(safeInteger(value), Number(value));
  }
  for (const value of [null, undefined, '', ' ', true, '1.5']) {
    assert.throws(() => safeInteger(value), TypeError);
  }
  for (const value of ['9007199254740993', 9007199254740993n, Infinity, NaN]) {
    assert.throws(() => safeInteger(value), RangeError);
  }
  assert.equal(nullableNumber(null), null);
  assert.equal(nullableNumber('1.5'), 1.5);
  assert.throws(() => nullableNumber(''), TypeError);
  assert.throws(() => nullableNumber('Infinity'), RangeError);
  assert.equal(serviceTime(null), null);
  assert.equal(serviceTime('32400'), '09:00:00');
  assert.equal(serviceTime('360000'), '100:00:00');
  assert.throws(() => serviceTime('-1'), RangeError);
});

test('representative and paginated-count recipes compile for each supported dialect', async () => {
  for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
    const database = new Kysely<GtfsDatabase>({
      dialect: createDummyDialect(dialect),
    });
    try {
      const page = representativeTrips(database, ["north' OR 1 = 1 --"])
        .select(['source_id', 'trip_id'])
        .orderBy('source_id')
        .offset(1)
        .limit(10);
      const compiled = database
        .selectFrom(page.as('page'))
        .select((eb) => integerText(eb.fn.countAll(), dialect).as('total'))
        .compile();
      assert.match(compiled.sql, /row_number\(\) over\s*\(partition by/);
      assert.match(compiled.sql, /order by .*trip_id.*desc/);
      assert.match(compiled.sql, dialect === 'mysql' ? /as char/ : /as text/);
      assert.equal(compiled.sql.includes("north'"), false);
      assert.ok(compiled.parameters.includes("north' OR 1 = 1 --"));
      assert.match(
        representativeTrips(database, []).select('trip_id').compile().sql,
        /1 = 0/,
      );
    } finally {
      await database.destroy();
    }
  }
});
