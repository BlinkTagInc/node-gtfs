import {
  scheduleRelationshipCases,
  flexRelationshipCases,
  realtimeRelationshipCases,
} from '../helpers/relationship-query-cases.ts';
import {
  verifyScheduleRelationshipQueries,
  verifyFlexRelationshipQueries,
  verifyRealtimeRelationshipQueries,
} from '../contracts/cases/keyed-relationship.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely } from 'kysely';
import type { GtfsDatabase } from '../../src/schema/index.ts';
import { verifyMonetarySqlFilters } from '../contracts/cases/monetary-filter.ts';
import { verifyServiceDateFilters } from '../contracts/cases/service-date-filter.ts';
import { verifyNullableRelationshipFilters } from '../contracts/cases/relationship-filter.ts';
import { verifyTextFilterIntegration } from '../contracts/cases/text-filter.ts';
import { createDummyDialect } from '../helpers/kysely-dialect.ts';
import {
  activeTripKeys,
  faresBelowMinorUnits,
  serviceDateWeekday,
  stopsContainingText,
  alertsForStop,
  parentStops,
  departuresAfterArrival,
  stopsContainingFoldedText,
} from '../helpers/advanced-filter-recipes.ts';

for (const [name, verify] of [
  ['relationship', verifyNullableRelationshipFilters],
  ['Schedule relationship', verifyScheduleRelationshipQueries],
  ['Flex relationship', verifyFlexRelationshipQueries],
  ['Realtime relationship', verifyRealtimeRelationshipQueries],
  ['monetary', verifyMonetarySqlFilters],
  ['service-date', verifyServiceDateFilters],
  ['text predicate', verifyTextFilterIntegration],
] as const) {
  test(`typed SQL ${name} recipes execute with native SQLite`, async () => {
    const client = new Database(':memory:');
    try {
      await verify({ client });
    } finally {
      client.close();
    }
  });
}

test('typed SQL filter recipes compile with source/feed correlation and bound inputs', async () => {
  for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
    const database = new Kysely<GtfsDatabase>({
      dialect: createDummyDialect(dialect),
    });
    try {
      const input = "x' OR 1 = 1 --";
      for (const cases of [
        scheduleRelationshipCases,
        flexRelationshipCases,
        realtimeRelationshipCases,
      ]) {
        for (const [name, query] of cases(database, input)) {
          const compiled = query.compile();
          assert.ok(compiled.parameters.includes(input), name);
          assert.equal(compiled.sql.includes(input), false, name);
        }
      }
      const alerts = alertsForStop(database, 'north', 'feed', input).compile();
      assert.match(alerts.sql, /exists/);
      for (const key of [
        'source_id',
        'realtime_feed_id',
        'alert_id',
        'entity_id',
      ]) {
        assert.ok(alerts.sql.includes(key));
      }
      assert.equal(alerts.sql.includes(input), false);
      assert.deepEqual(alerts.parameters, ['north', 'feed', input]);
      const parent = database
        .selectFrom('stops')
        .select('stop_id')
        .where('source_id', '=', 'north')
        .where((eb) => eb.not(eb.exists(parentStops(eb))))
        .compile();
      assert.match(parent.sql, /not exists/);
      assert.ok(parent.sql.includes('parent_station'));
      const times = departuresAfterArrival(database, 'north').compile();
      assert.ok(times.sql.includes('departure_service_day_seconds'));
      assert.ok(times.sql.includes('arrival_service_day_seconds'));
      const text = stopsContainingFoldedText(
        database,
        'north',
        '100%_!',
      ).compile();
      assert.match(text.sql, /escape '!'/);
      assert.deepEqual(text.parameters, ['north', '%100!%!_!!%']);
      const literal = stopsContainingText(
        database,
        dialect,
        'north',
        input + '%_!*?[',
      ).compile();
      assert.equal(literal.sql.includes(input), false);
      assert.match(literal.sql, dialect === 'sqlite' ? /glob/ : /like/);
      assert.deepEqual(literal.parameters, [
        'north',
        dialect === 'sqlite' ? `*${input}%_![*][?][[]*` : `%${input}!%!_!!*?[%`,
      ]);
      const service = activeTripKeys(database, 20260826).compile();
      assert.match(service.sql, /union/);
      assert.match(service.sql, /not exists/);
      assert.ok(service.sql.includes('wednesday'));
      assert.ok(service.parameters.includes(20260826));
      assert.equal(service.sql.includes('20260826'), false);
      const fares = faresBelowMinorUnits(
        database,
        'north',
        'USD',
        '9007199254740993',
      )
        .select('fare_id')
        .compile();
      assert.deepEqual(fares.parameters, ['north', 'USD', '9007199254740993']);
      assert.equal(fares.sql.includes('9007199254740993'), false);
    } finally {
      await database.destroy();
    }
  }
});

test('application service-date recipe validates dates before choosing a weekday column', () => {
  for (const [date, weekday] of [
    [20260823, 'sunday'],
    [20260824, 'monday'],
    [20260825, 'tuesday'],
    [20260826, 'wednesday'],
    [20260827, 'thursday'],
    [20260828, 'friday'],
    [20260829, 'saturday'],
    [20240229, 'thursday'],
  ] as const) {
    assert.equal(serviceDateWeekday(date), weekday);
  }
  for (const date of [
    NaN,
    Infinity,
    20260229,
    20261301,
    20260431,
    20260001,
    20260900,
    20260826.5,
    2026082,
    '20260826' as never,
  ]) {
    assert.throws(() => serviceDateWeekday(date), TypeError);
  }
});
