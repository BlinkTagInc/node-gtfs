import assert from 'node:assert/strict';
import { sql, type Kysely } from 'kysely';
import { foldGtfsText, type GtfsDatabaseDialect } from '../../src/kysely.ts';
import type { GtfsDatabase } from '../../src/schema/index.ts';
import { textFilterRows } from './text-filter-fixture.ts';
import {
  activeTripKeys,
  literalLike,
  stopsContainingText,
  stopsContainingFoldedText,
  stopsMatchingPattern,
} from './advanced-filter-recipes.ts';
import { integerText, safeInteger } from './advanced-summary-recipes.ts';

// Explicit SQL text-filter cases. Keep the
// queries concrete: this fixture must not become another filter interpreter.
export function textFilterSqlCases(
  db: Kysely<GtfsDatabase>,
  dialect: GtfsDatabaseDialect,
  sourceId: string,
) {
  const stops = db
    .selectFrom('stops')
    .where('source_id', '=', sourceId)
    .select('stop_id');
  const foldedName = sql<string>`${sql.ref('stops._node_gtfs_casefold_stop_name')}`;
  const nonNullIds = textFilterRows
    .filter(([id]) => id !== 'o')
    .map(([id]) => id);
  const withoutStrasse = nonNullIds.filter((id) => id !== 'c' && id !== 'd');
  const sensitive = (sqlite: string, sqlPattern: string) =>
    stopsMatchingPattern(db, dialect, sourceId, { sqlite, sql: sqlPattern });
  const street =
    dialect === 'sqlite'
      ? sql<boolean>`${sql.ref('stops.stop_name')} glob ${'*Street*'}`
      : sql<boolean>`${sql.ref('stops.stop_name')} like ${'%Street%'} escape '!'`;
  return [
    [
      'contains is case-sensitive',
      stopsContainingText(db, dialect, sourceId, 'Street'),
      ['a'],
    ],
    ['prefix is case-sensitive', sensitive('market*', 'market%'), ['b']],
    ['suffix is case-sensitive', sensitive('*Station', '%Station'), ['a', 'p']],
    [
      'lowercase literal is case-sensitive',
      stopsContainingText(db, dialect, sourceId, 'street'),
      ['b'],
    ],
    [
      'contains insensitive',
      stopsContainingFoldedText(db, sourceId, foldGtfsText('STREET')),
      ['a', 'b'],
    ],
    [
      'prefix insensitive',
      stops.where(
        sql<boolean>`${foldedName} like ${foldGtfsText('MARKET') + '%'} escape '!'`,
      ),
      ['a', 'b'],
    ],
    [
      'suffix insensitive',
      stops.where(
        sql<boolean>`${foldedName} like ${'%' + foldGtfsText('station')} escape '!'`,
      ),
      ['a', 'b', 'p'],
    ],
    [
      'multiple text conditions',
      sensitive('Market*Station', 'Market%Station').where(street),
      ['a'],
    ],
    [
      'equals insensitive',
      stops.where(foldedName, '=', foldGtfsText('STRASSE')),
      ['c', 'd'],
    ],
    [
      'contains Unicode expansion',
      stopsContainingFoldedText(db, sourceId, foldGtfsText('strasse')),
      ['c', 'd'],
    ],
    [
      'prefix Unicode expansion',
      stops.where(
        sql<boolean>`${foldedName} like ${foldGtfsText('STRASS') + '%'} escape '!'`,
      ),
      ['c', 'd'],
    ],
    [
      'suffix Unicode expansion',
      stops.where(
        sql<boolean>`${foldedName} like ${'%' + foldGtfsText('SSE')} escape '!'`,
      ),
      ['c', 'd'],
    ],
    [
      'membership folds every operand',
      stops.where(foldedName, 'in', ['strasse', 'café'].map(foldGtfsText)),
      ['c', 'd', 'h'],
    ],
    [
      'inequality excludes null',
      stops.where(foldedName, '!=', foldGtfsText('strasse')),
      withoutStrasse,
    ],
    [
      'not in excludes null',
      stops.where(foldedName, 'not in', [foldGtfsText('strasse')]),
      withoutStrasse,
    ],
    [
      'double negation of folded search',
      stops.where((eb) =>
        eb.not(
          eb.not(
            sql<boolean>`${foldedName} like ${'%' + foldGtfsText('STRASSE') + '%'} escape '!'`,
          ),
        ),
      ),
      ['c', 'd'],
    ],
    [
      'double negation of case-sensitive equality',
      stops.where((eb) => eb.not(eb.not(eb('stop_name', '=', 'STRASSE')))),
      ['d'],
    ],
    [
      'canonical Unicode normalization',
      stops.where(foldedName, '=', foldGtfsText('ångström')),
      ['e', 'f'],
    ],
    [
      'Greek sigma folding',
      stops.where(foldedName, '=', foldGtfsText('σσσ')),
      ['g'],
    ],
    [
      'accents are retained',
      stops.where(
        sql<boolean>`${foldedName} like ${foldGtfsText('cafe') + '%'} escape '!'`,
      ),
      ['i'],
    ],
    [
      'accented letters fold',
      stops.where(foldedName, '=', foldGtfsText('café')),
      ['h'],
    ],
    [
      'default non-Turkic folding',
      stops.where(foldedName, '=', foldGtfsText('ISTANBUL')),
      ['k'],
    ],
    [
      'Turkish dotted I retains dot',
      stops.where(foldedName, '=', foldGtfsText('i\u0307stanbul')),
      ['j'],
    ],
    [
      'percent and underscore are literal',
      sensitive('100%_*', '100!%!_%'),
      ['l'],
    ],
    [
      'SQL and glob syntax is literal',
      stopsContainingText(db, dialect, sourceId, '%_[x]*?!\\'),
      ['l'],
    ],
    ['glob bracket escaping', sensitive('*]b[[]-[?][*]^', '%]b[-?*^'), ['r']],
    [
      'folding preserves literal syntax',
      stops.where(
        sql<boolean>`${foldedName} like ${'%' + literalLike(foldGtfsText('%_[X]*?!\\END'))} escape '!'`,
      ),
      ['l'],
    ],
    [
      'quotes and newlines are literal',
      stopsContainingText(db, dialect, sourceId, "O'Brien\n"),
      ['p'],
    ],
    ['non-Latin and emoji text', sensitive('*点🚉', '%点🚉'), ['q']],
    [
      'empty contains',
      stopsContainingText(db, dialect, sourceId, ''),
      nonNullIds,
    ],
    ['empty prefix', sensitive('*', '%'), nonNullIds],
    [
      'empty folded suffix',
      stops.where(sql<boolean>`${foldedName} like ${'%'} escape '!'`),
      nonNullIds,
    ],
    ['empty folded equality', stops.where(foldedName, '=', ''), ['n']],
    [
      'null equality uses the original column',
      stops.where('stop_name', 'is', null),
      ['o'],
    ],
    [
      'not null uses the original column',
      stops.where('stop_name', 'is not', null),
      nonNullIds,
    ],
    // IN () is not portable. Applications handle empty sets explicitly.
    ['empty membership', stops.where((eb) => eb.or([])), []],
    [
      'empty exclusion',
      stops.where((eb) => eb.and([])),
      textFilterRows.map(([id]) => id),
    ],
    [
      'negated empty search',
      stops.where((eb) =>
        eb.not(
          dialect === 'sqlite'
            ? sql<boolean>`${eb.ref('stop_name')} glob ${'*'}`
            : sql<boolean>`${eb.ref('stop_name')} like ${'%'} escape '!'`,
        ),
      ),
      [],
    ],
    [
      'null included with OR',
      stops.where((eb) => eb.or([street, eb('stop_name', 'is', null)])),
      ['a', 'o'],
    ],
    [
      'explicit source scope encloses OR',
      stops.where((eb) => eb.or([eb('source_id', '=', 'south'), street])),
      ['a'],
    ],
    [
      'folded ordering comparisons',
      stops
        .where(foldedName, '>=', foldGtfsText('STRASSE'))
        .where(foldedName, '<=', foldGtfsText('STRASSE')),
      ['c', 'd'],
    ],
    [
      'identifier prefixes',
      stops.where((eb) =>
        dialect === 'sqlite'
          ? sql<boolean>`${eb.ref('stop_id')} glob ${'a*'}`
          : sql<boolean>`${eb.ref('stop_id')} like ${'a%'} escape '!'`,
      ),
      ['a'],
    ],
    [
      'source ID prefixes',
      stops
        .where('stop_id', '=', 'a')
        .where((eb) =>
          dialect === 'sqlite'
            ? sql<boolean>`${eb.ref('source_id')} glob ${'no*'}`
            : sql<boolean>`${eb.ref('source_id')} like ${'no%'} escape '!'`,
        ),
      ['a'],
    ],
    [
      'source-aware joins and service date',
      stops.where((eb) =>
        eb.exists(
          eb
            .selectFrom('stop_times as time')
            .innerJoin(activeTripKeys(db, 20260911).as('active'), (join) =>
              join
                .onRef('active.source_id', '=', 'time.source_id')
                .onRef('active.trip_id', '=', 'time.trip_id'),
            )
            .innerJoin('trips as trip', (join) =>
              join
                .onRef('trip.source_id', '=', 'time.source_id')
                .onRef('trip.trip_id', '=', 'time.trip_id'),
            )
            .innerJoin('routes as route', (join) =>
              join
                .onRef('route.source_id', '=', 'trip.source_id')
                .onRef('route.route_id', '=', 'trip.route_id'),
            )
            .whereRef('time.source_id', '=', 'stops.source_id')
            .whereRef('time.stop_id', '=', 'stops.stop_id')
            .where(
              sql<boolean>`${sql.ref('route._node_gtfs_casefold_route_short_name')} like ${'%' + foldGtfsText('RÉD') + '%'} escape '!'`,
            )
            .select('time.stop_id'),
        ),
      ),
      ['a'],
    ],
  ] as const;
}

export async function verifyTextFilterSqlCase(
  db: Kysely<GtfsDatabase>,
  dialect: GtfsDatabaseDialect,
  [name, query, expected]: ReturnType<typeof textFilterSqlCases>[number],
) {
  const ordered = query.orderBy('stop_id');
  assert.deepEqual(
    await ordered.execute(),
    expected.map((stop_id) => ({ stop_id })),
    name,
  );
  assert.deepEqual(
    await ordered.executeTakeFirst(),
    expected[0] === undefined ? undefined : { stop_id: expected[0] },
    name,
  );
  const total = await db
    .selectFrom(query.as('matching'))
    .select((eb) => integerText(eb.fn.countAll(), dialect).as('total'))
    .executeTakeFirstOrThrow();
  assert.equal(safeInteger(total.total), expected.length, name);
}
