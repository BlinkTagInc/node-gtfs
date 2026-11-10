import assert from 'node:assert/strict';
import {
  sql,
  type ExpressionBuilder,
  type Expression,
  type SqlBool,
} from 'kysely';
import type { GtfsDatabase } from '../../../src/schema/index.ts';
import { Gtfs, type GtfsDatabaseConfig } from '../../../src/index.ts';
import {
  parentStops,
  childStops,
  alertsForStop,
} from '../../helpers/advanced-filter-recipes.ts';
import {
  integerText,
  safeInteger,
} from '../../helpers/advanced-summary-recipes.ts';

export async function verifyNullableRelationshipFilters(
  database: GtfsDatabaseConfig,
): Promise<void> {
  const gtfs = new Gtfs({
    database,
    extensions: ['gtfs-realtime'],
    sources: [{ sourceId: 'north' }],
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.recreate();
    await gtfs.database.withKysely({
      callback: async (db) => {
        await sql`insert into stops (source_id, stop_id, stop_name, parent_station) values
        ('north', 'parent', 'Parent', null),
        ('north', 'child', 'Child', 'parent'),
        ('north', 'null', 'Child', null),
        ('north', 'dangling', 'Child', 'missing'),
        ('north', 'foreign', 'Child', 'remote'),
        ('north', 'other', 'Other parent', null),
        ('north', 'other-child', 'Child', 'other'),
        ('north', 'unused', 'Unused', null),
        ('south', 'parent', 'Other parent', null),
        ('south', 'child', 'Child', 'parent'),
        ('south', 'remote', 'Parent', null)`.execute(db);
      },
    });
    const allIds = [
      'child',
      'dangling',
      'foreign',
      'null',
      'other',
      'other-child',
      'parent',
      'unused',
    ];
    type StopExpression = ExpressionBuilder<GtfsDatabase, 'stops'>;
    const parentMatch = (eb: StopExpression) =>
      eb.exists(parentStops(eb).where('parent.stop_name', '=', 'Parent'));
    const childMatch = (eb: StopExpression) =>
      eb.exists(childStops(eb).where('child.stop_name', '=', 'Child'));
    const nestedChildren = (eb: StopExpression) =>
      childStops(eb).where((child) =>
        child.exists(
          child
            .selectFrom('stops as grandparent')
            .select('grandparent.stop_id')
            .whereRef('grandparent.source_id', '=', 'child.source_id')
            .whereRef('grandparent.stop_id', '=', 'child.parent_station')
            .where('grandparent.stop_name', '=', 'Parent'),
        ),
      );
    const cases: readonly [
      string,
      (eb: StopExpression) => Expression<SqlBool>,
      readonly string[],
    ][] = [
      ['nullable source key', parentMatch, ['child']],
      [
        'negated nullable source key',
        (eb) => eb.not(parentMatch(eb)),
        allIds.filter((id) => id !== 'child'),
      ],
      ['double negation', (eb) => eb.not(eb.not(parentMatch(eb))), ['child']],
      ['nullable target key', childMatch, ['other', 'parent']],
      [
        'negated nullable target key',
        (eb) => eb.not(childMatch(eb)),
        allIds.filter((id) => id !== 'other' && id !== 'parent'),
      ],
      [
        'no related row',
        (eb) => eb.not(eb.exists(parentStops(eb))),
        ['dangling', 'foreign', 'null', 'other', 'parent', 'unused'],
      ],
      [
        'any related row',
        (eb) => eb.exists(parentStops(eb)),
        ['child', 'other-child'],
      ],
      [
        'negative filtered relationship',
        (eb) => eb.not(parentMatch(eb)),
        allIds.filter((id) => id !== 'child'),
      ],
      [
        'no matching children',
        (eb) => eb.not(childMatch(eb)),
        allIds.filter((id) => id !== 'other' && id !== 'parent'),
      ],
      [
        'every with missing targets',
        (eb) =>
          eb.not(
            eb.exists(
              parentStops(eb).where((parent) =>
                parent.not(parent('parent.stop_name', '=', 'Parent')),
              ),
            ),
          ),
        allIds.filter((id) => id !== 'other-child'),
      ],
      [
        'nested self relationship',
        (eb) => eb.exists(nestedChildren(eb)),
        ['parent'],
      ],
      [
        'negative nested relationship',
        (eb) => eb.not(eb.exists(nestedChildren(eb))),
        allIds.filter((id) => id !== 'parent'),
      ],
      [
        'every nested relationship',
        (eb) =>
          eb.not(
            eb.exists(
              childStops(eb).where((child) =>
                child.not(
                  child.exists(
                    child
                      .selectFrom('stops as grandparent')
                      .select('grandparent.stop_id')
                      .whereRef('grandparent.source_id', '=', 'child.source_id')
                      .whereRef(
                        'grandparent.stop_id',
                        '=',
                        'child.parent_station',
                      )
                      .where('grandparent.stop_name', '=', 'Parent'),
                  ),
                ),
              ),
            ),
          ),
        allIds.filter((id) => id !== 'other'),
      ],
      [
        'OR includes missing parent',
        (eb) => eb.or([parentMatch(eb), eb('stop_id', '=', 'null')]),
        ['child', 'null'],
      ],
      [
        'AND with negation',
        (eb) =>
          eb.and([eb.not(parentMatch(eb)), eb('stop_name', '=', 'Child')]),
        ['dangling', 'foreign', 'null', 'other-child'],
      ],
      [
        'empty nested OR',
        (eb) => eb.exists(childStops(eb).where((child) => child.or([]))),
        [],
      ],
      [
        'negative empty nested OR',
        (eb) =>
          eb.not(eb.exists(childStops(eb).where((child) => child.or([])))),
        allIds,
      ],
      // NOT UNKNOWN stays UNKNOWN, so null child values do not violate this predicate.
      [
        'every nullable comparison',
        (eb) =>
          eb.not(
            eb.exists(
              childStops(eb).where((child) =>
                child.not(child('child.stop_lat', '>', 0)),
              ),
            ),
          ),
        allIds,
      ],
      [
        'every requiring present values',
        (eb) =>
          eb.not(
            eb.exists(
              childStops(eb).where((child) =>
                child.or([
                  child('child.stop_lat', 'is', null),
                  child('child.stop_lat', '<=', 0),
                ]),
              ),
            ),
          ),
        allIds.filter((id) => id !== 'other' && id !== 'parent'),
      ],
      [
        'explicit source scope survives OR',
        (eb) => eb.or([eb('source_id', '=', 'south'), parentMatch(eb)]),
        ['child'],
      ],
    ];
    await gtfs.database.withKysely({
      callback: async (db) => {
        for (const [name, where, expected] of cases) {
          const query = db
            .selectFrom('stops')
            .where('source_id', '=', 'north')
            .where(where)
            .select('stop_id')
            .orderBy('stop_id');
          assert.deepEqual(
            await query.execute(),
            expected.map((stop_id) => ({ stop_id })),
            name,
          );
          assert.deepEqual(
            (await query.executeTakeFirst()) ?? null,
            expected.length === 0 ? null : { stop_id: expected[0] },
            name,
          );
          const result = await db
            .selectFrom(query.as('matches'))
            .select((eb) =>
              integerText(eb.fn.countAll(), gtfs.database.dialect).as('total'),
            )
            .executeTakeFirstOrThrow();
          assert.equal(safeInteger(result.total), expected.length, name);
        }
        await sql`insert into alerts
          (source_id, realtime_feed_id, entity_id, header_text, description_text, created_at_unix_seconds, expires_at_unix_seconds) values
          ('north', 'one', 'match', 'Match', '', 0, 100),
          ('north', 'one', 'foreign-source', 'Foreign', '', 0, 100),
          ('north', 'one', 'foreign-feed', 'Foreign', '', 0, 100),
          ('north', 'one', 'missing', 'Missing', '', 0, 100),
          ('north', 'two', 'match', 'Other feed', '', 0, 100),
          ('south', 'one', 'match', 'Other source', '', 0, 100)`.execute(db);
        await sql`insert into alert_entity_selectors
          (source_id, realtime_feed_id, alert_id, selector_ordinal, stop_id, created_at_unix_seconds, expires_at_unix_seconds) values
          ('north', 'one', 'match', 0, 'child', 0, 100),
          ('north', 'one', 'match', 1, 'child', 0, 100),
          ('south', 'one', 'foreign-source', 0, 'child', 0, 100),
          ('north', 'two', 'foreign-feed', 0, 'child', 0, 100),
          ('north', 'one', 'missing', 0, null, 0, 100)`.execute(db);
        assert.deepEqual(
          await alertsForStop(db, 'north', 'one', 'child').execute(),
          [{ entity_id: 'match' }],
        );
        assert.deepEqual(
          await alertsForStop(db, 'north', 'two', 'child').execute(),
          [],
        );
        assert.deepEqual(
          await alertsForStop(db, 'south', 'one', 'child').execute(),
          [],
        );
      },
    });
  } finally {
    await gtfs.close();
  }
}
