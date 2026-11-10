import {
  textFilterSqlCases,
  verifyTextFilterSqlCase,
} from '../../helpers/text-filter-sql-cases.ts';
import {
  stopsContainingText,
  stopsMatchingPattern,
  stopsContainingFoldedText,
} from '../../helpers/advanced-filter-recipes.ts';
import { foldGtfsText } from '../../../src/kysely.ts';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sql } from 'kysely';
import {
  Gtfs,
  importGtfs,
  type GtfsImportOptions,
} from '../../../src/index.ts';
import { writeTextFilterFixture } from '../../helpers/text-filter-fixture.ts';
export async function verifyTextFilterIntegration(
  database: GtfsImportOptions['database'],
): Promise<void> {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'gtfs-text-integration-'),
  );
  const gtfs = new Gtfs({
    database,
    sources: [{ sourceId: 'north' }],
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.recreate();
    await writeTextFilterFixture(directory);
    await importGtfs({
      database,
      sources: ['north', 'south'].map((sourceId) => ({
        sourceId,
        schedule: {
          path: directory,
          import: { validation: { mode: 'permissive' } },
        },
      })),
      reporting: { level: 'silent' },
    });
    await gtfs.database.withKysely({
      callback: (db) =>
        sql`update stops set stop_name = '', _node_gtfs_casefold_stop_name = '' where stop_id = 'n'`.execute(
          db,
        ),
    });
    await gtfs.database.withKysely({
      callback: async (db) => {
        for (const [search, expected] of [
          ['STRASSE', ['c', 'd']],
          ['ÅNGSTRÖM', ['e', 'f']],
          ['ΣΣΣ', ['g']],
          ['cafe', ['i']],
          ['%_[X]*?!\\END', ['l']],
          ["O'Brien\n", ['p']],
          ['点🚉', ['q']],
        ] as const) {
          assert.deepEqual(
            await stopsContainingFoldedText(db, 'north', foldGtfsText(search))
              .orderBy('stop_id')
              .execute(),
            expected.map((stop_id) => ({ stop_id })),
            `SQL literal casefold search ${search}`,
          );
        }
        for (const [search, expected] of [
          ['Street', ['a']],
          ['street', ['b']],
          ['STRASSE', ['d']],
          ['%_[x]*?!\\', ['l']],
          [']b[-?*^', ['r']],
          ["O'Brien\n", ['p']],
          ['点🚉', ['q']],
          [
            '',
            [
              'a',
              'b',
              'c',
              'd',
              'e',
              'f',
              'g',
              'h',
              'i',
              'j',
              'k',
              'l',
              'm',
              'n',
              'p',
              'q',
              'r',
            ],
          ],
        ] as const) {
          assert.deepEqual(
            await stopsContainingText(
              db,
              gtfs.database.dialect,
              'north',
              search,
            )
              .orderBy('stop_id')
              .execute(),
            expected.map((stop_id) => ({ stop_id })),
            `case-sensitive literal ${search}`,
          );
        }
        for (const [sqlite, pattern, expected] of [
          ['Market*', 'Market%', ['a']],
          ['market*', 'market%', ['b']],
          ['*Station', '%Station', ['a', 'p']],
          ['Mar?et*', 'Mar_et%', ['a']],
          ['100%_*', '100!%!_%', ['l']],
          ['*[*][?]!*', '%*?!!%', ['l']],
          ['a]b[[]-*', 'a]b[-%', ['r']],
        ] as const) {
          assert.deepEqual(
            await stopsMatchingPattern(db, gtfs.database.dialect, 'north', {
              sqlite,
              sql: pattern,
            })
              .orderBy('stop_id')
              .execute(),
            expected.map((stop_id) => ({ stop_id })),
            `case-sensitive pattern ${pattern}`,
          );
        }
        const stops = db
          .selectFrom('stops')
          .where('source_id', '=', 'north')
          .select('stop_id')
          .orderBy('stop_id');
        assert.deepEqual(
          await stops
            .where(
              sql.ref('stops._node_gtfs_casefold_stop_name'),
              '=',
              foldGtfsText('STRASSE'),
            )
            .execute(),
          [{ stop_id: 'c' }, { stop_id: 'd' }],
        );
        assert.deepEqual(
          await stops.where('stop_name', '=', 'STRASSE').execute(),
          [{ stop_id: 'd' }],
        );
        assert.deepEqual(await stops.where('stop_name', 'is', null).execute(), [
          { stop_id: 'o' },
        ]);
        assert.deepEqual(
          await stops
            .where((eb) =>
              eb.or([eb('stop_name', 'is', null), eb('stop_name', '=', '')]),
            )
            .execute(),
          [{ stop_id: 'n' }, { stop_id: 'o' }],
        );
        assert.deepEqual(
          await stops.where('stop_id', 'in', ['a', 'c']).execute(),
          [{ stop_id: 'a' }, { stop_id: 'c' }],
        );
        // Empty arrays need an explicit constant; IN () is not portable SQL.
        const ids: string[] = [];
        assert.deepEqual(
          await stops
            .where((eb) =>
              ids.length === 0 ? eb.or([]) : eb('stop_id', 'in', ids),
            )
            .execute(),
          [],
        );
        assert.equal(
          (
            await stops
              .where((eb) =>
                ids.length === 0 ? eb.and([]) : eb('stop_id', 'not in', ids),
              )
              .execute()
          ).length,
          18,
        );
        assert.equal(
          (await stops.where('stop_name', '!=', 'STRASSE').execute()).length,
          16,
        );
        assert.equal(
          (await stops.where('stop_name', 'not in', ['STRASSE']).execute())
            .length,
          16,
        );
      },
    });
    await gtfs.database.withKysely({
      callback: async (db) => {
        for (const entry of textFilterSqlCases(
          db,
          gtfs.database.dialect,
          'north',
        )) {
          await verifyTextFilterSqlCase(db, gtfs.database.dialect, entry);
        }
      },
    });
    for (const [search, ids] of [
      ['STRASSE', ['c', 'd']],
      ['100%_', ['l']],
    ] as const) {
      const literal = foldGtfsText(search).replace(/[!%_]/g, '!$&');
      const collection = await gtfs.geojson.stops({
        sqlWhere: () =>
          sql<boolean>`${sql.ref('stops._node_gtfs_casefold_stop_name')} like ${`%${literal}%`} escape '!'`,
      });
      assert.deepEqual(
        collection.features.map(({ properties }) => properties.stop_id),
        ids,
      );
    }
    const stops = await gtfs.geojson.stops({
      sqlWhere: () =>
        sql<boolean>`${sql.ref('stops._node_gtfs_casefold_stop_name')} like ${'%' + foldGtfsText('STRASSE') + '%'} escape '!'`,
    });
    assert.deepEqual(
      stops.features.map(({ properties }) => [
        properties.source_id,
        properties.stop_id,
        properties.stop_name,
      ]),
      [
        ['north', 'c', 'Straße'],
        ['north', 'd', 'STRASSE'],
      ],
    );
    const routes = await gtfs.geojson.routes({
      sqlWhere: () =>
        sql<boolean>`${sql.ref('routes._node_gtfs_casefold_route_short_name')} like ${'%' + foldGtfsText('RÉD') + '%'} escape '!'`,
    });
    assert.deepEqual(
      routes.features.map(({ properties }) => [
        properties.source_id,
        properties.route_id,
      ]),
      [['north', 'red']],
    );
    const shapes = await gtfs.geojson.shapes({
      sqlWhere: (eb) =>
        eb.exists(
          eb
            .selectFrom('trips as selected_trip')
            .innerJoin('routes as selected_route', (join) =>
              join
                .onRef(
                  'selected_route.source_id',
                  '=',
                  'selected_trip.source_id',
                )
                .onRef(
                  'selected_route.route_id',
                  '=',
                  'selected_trip.route_id',
                ),
            )
            .select('selected_trip.trip_id')
            .whereRef('selected_trip.source_id', '=', 'shapes.source_id')
            .whereRef('selected_trip.shape_id', '=', 'shapes.shape_id')
            .where(
              sql<boolean>`${sql.ref('selected_route._node_gtfs_casefold_route_short_name')} like ${'%' + foldGtfsText('ÉD')} escape '!'`,
            ),
        ),
    });
    assert.deepEqual(
      shapes.features.map(({ properties }) => [
        properties.source_id,
        properties.shape_id,
      ]),
      [['north', 'shape']],
    );
    for (const where of [
      { stop_id: { contains: 'a', mode: 'insensitive' } },
      { stop_name: { contains: 1 } },
      { stop_lat: { startsWith: '0' } },
      { stop_name: { equals: 'Market', mode: 'unknown' } },
    ]) {
      await assert.rejects(
        async () => gtfs.schedule.stops.where(where as never).count(),
        {
          code: 'GTFS_QUERY_INVALID',
        },
      );
    }
    await gtfs.database.withKysely({
      callback: (db) =>
        sql`alter table stops drop column _node_gtfs_casefold_stop_name`.execute(
          db,
        ),
    });
    await assert.rejects(
      () =>
        gtfs.geojson.stops({
          sqlWhere: () =>
            sql<boolean>`${sql.ref('stops._node_gtfs_casefold_stop_name')} = ${foldGtfsText('market')}`,
        }),
      /_node_gtfs_casefold_stop_name/u,
    );
    await gtfs.database.withKysely({
      callback: async (db) => {
        const query = stopsContainingFoldedText(
          db,
          'north',
          foldGtfsText('market'),
        );
        for (const run of [
          () => query.execute(),
          () => query.executeTakeFirst(),
          () =>
            db
              .selectFrom(query.as('matching'))
              .select((eb) => eb.fn.countAll().as('total'))
              .execute(),
        ]) {
          await assert.rejects(run, /_node_gtfs_casefold_stop_name/u);
        }
        assert.deepEqual(
          await stopsContainingText(
            db,
            gtfs.database.dialect,
            'north',
            'Market',
          ).execute(),
          [{ stop_id: 'a' }],
        );
      },
    });
    await gtfs.database.withKysely({
      callback: (db) =>
        sql`alter table stops add column _node_gtfs_casefold_stop_name integer`.execute(
          db,
        ),
    });
    // Arbitrary SQL does not run reader schema preflight. Explicit schema
    // validation still reports an incompatible companion-column type.
    const inspection = await gtfs.schema.validate();
    assert.equal(inspection.compatible, false);
    assert.ok(
      inspection.tableIssues.some(
        (issue) =>
          issue.tableName === 'stops' &&
          issue.incompatibleColumnTypes.some(
            (column) =>
              column.columnName === '_node_gtfs_casefold_stop_name' &&
              column.expectedType === 'text',
          ),
      ),
    );
  } finally {
    await gtfs.close();
    await rm(directory, { recursive: true, force: true });
  }
}
