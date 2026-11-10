import {
  stopsContainingFoldedText,
  stopsContainingText,
} from '../helpers/advanced-filter-recipes.ts';
import {
  textFilterSqlCases,
  verifyTextFilterSqlCase,
} from '../helpers/text-filter-sql-cases.ts';
import { foldGtfsText } from '../../src/kysely.ts';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, sql } from 'kysely';
import type { GtfsDatabase } from '../../src/schema/index.ts';
import { createDummyDialect } from '../helpers/kysely-dialect.ts';
import { Gtfs, importGtfs } from '../../src/index.ts';
import { writeTextFilterFixture } from '../helpers/text-filter-fixture.ts';
const sqlite = new Database(':memory:');
const database = { client: sqlite } as const;
const gtfs = new Gtfs({
  database,
  sources: [{ sourceId: 'north' }],
  reporting: { level: 'silent' },
});
let directory: string;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'gtfs-text-filters-'));
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
  // CSV empty cells normalize to null; also exercise an explicitly stored empty string.
  sqlite.exec(
    "UPDATE stops SET stop_name = '', _node_gtfs_casefold_stop_name = '' WHERE stop_id = 'n'",
  );
});
after(async () => {
  await gtfs.close();
  sqlite.close();
  if (directory !== undefined) {
    await rm(directory, { recursive: true, force: true });
  }
});
test('SQL text filtering', async (t) => {
  await gtfs.database.withKysely({
    callback: async (db) => {
      for (const entry of textFilterSqlCases(
        db,
        gtfs.database.dialect,
        'north',
      )) {
        await t.test(entry[0], () =>
          verifyTextFilterSqlCase(db, gtfs.database.dialect, entry),
        );
      }
    },
  });
});
test('SQL text cases compile with each dialect and bind source and search values', async () => {
  for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
    const db = new Kysely<GtfsDatabase>({
      dialect: createDummyDialect(dialect),
    });
    try {
      for (const [name, query] of textFilterSqlCases(
        db,
        dialect,
        "north' OR 1=1 --",
      )) {
        const compiled = query.compile();
        assert.equal(compiled.parameters[0], "north' OR 1=1 --", name);
        assert.doesNotMatch(compiled.sql, /OR 1=1/u, name);
        assert.doesNotMatch(compiled.sql, /in\s*\(\s*\)/iu, name);
        if (name === 'quotes and newlines are literal') {
          assert.ok(
            compiled.parameters.some(
              (value) =>
                typeof value === 'string' && value.includes("O'Brien\n"),
            ),
            name,
          );
          assert.doesNotMatch(compiled.sql, /O'Brien/u, name);
          assert.match(
            compiled.sql,
            dialect === 'sqlite' ? / glob /u : / like .* escape '!'/u,
            name,
          );
        }
      }
    } finally {
      await db.destroy();
    }
  }
});
test('GeoJSON SQL predicates preserve folded text and source-aware joins', async () => {
  const stops = await gtfs.geojson.stops({
    sqlWhere: () =>
      sql<boolean>`${sql.ref('stops._node_gtfs_casefold_stop_name')} like ${'%' + foldGtfsText('STREET') + '%'} escape '!'`,
  });
  assert.deepEqual(
    stops.features.map(({ properties }) => [
      properties.source_id,
      properties.stop_id,
    ]),
    [
      ['north', 'a'],
      ['north', 'b'],
    ],
  );
  const routes = await gtfs.geojson.routes({
    sqlWhere: () =>
      sql<boolean>`${sql.ref('routes._node_gtfs_casefold_route_short_name')} = ${foldGtfsText('RÉD')}`,
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
              .onRef('selected_route.source_id', '=', 'selected_trip.source_id')
              .onRef('selected_route.route_id', '=', 'selected_trip.route_id'),
          )
          .select('selected_trip.trip_id')
          .whereRef('selected_trip.source_id', '=', 'shapes.source_id')
          .whereRef('selected_trip.shape_id', '=', 'shapes.shape_id')
          .where(
            sql<boolean>`${sql.ref('selected_route._node_gtfs_casefold_route_short_name')} like ${foldGtfsText('ré') + '%'} escape '!'`,
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
});
test('SQL folded searches report missing companion columns without permanent caching', async () => {
  const other = new Gtfs({ database: {}, reporting: { level: 'silent' } });
  try {
    await other.schema.ensure();
    await other.database.withKysely({
      callback: async (db) => {
        const query = stopsContainingFoldedText(
          db,
          'north',
          foldGtfsText('market'),
        );
        assert.deepEqual(await query.execute(), []);
        await sql`alter table stops drop column _node_gtfs_casefold_stop_name`.execute(
          db,
        );
        for (const run of [
          () => query.execute(),
          () => query.executeTakeFirst(),
          () =>
            db
              .selectFrom(query.as('matching'))
              .select((eb) => eb.fn.countAll().as('total'))
              .execute(),
          () =>
            db
              .selectFrom('trips')
              .where('source_id', '=', 'north')
              .where((eb) =>
                eb.exists(
                  eb
                    .selectFrom('stop_times as time')
                    .innerJoin(
                      query.as('matching'),
                      'matching.stop_id',
                      'time.stop_id',
                    )
                    .whereRef('time.source_id', '=', 'trips.source_id')
                    .whereRef('time.trip_id', '=', 'trips.trip_id')
                    .select('time.trip_id'),
                ),
              )
              .select('trip_id')
              .execute(),
        ]) {
          await assert.rejects(run, /_node_gtfs_casefold_stop_name/u);
        }
        assert.deepEqual(
          await stopsContainingText(db, 'sqlite', 'north', 'market').execute(),
          [],
        );
        assert.deepEqual(
          await db
            .selectFrom('stops')
            .where('source_id', '=', 'north')
            .where('stop_name', 'is', null)
            .select('stop_id')
            .execute(),
          [],
        );
        await sql`alter table stops add column _node_gtfs_casefold_stop_name text`.execute(
          db,
        );
        assert.deepEqual(await query.execute(), []);
      },
    });
  } finally {
    await other.close();
  }
});
test('prefix searches leave indexed text columns bare and returned text unchanged', async () => {
  sqlite.exec(
    'CREATE INDEX test_stop_name ON stops (stop_name); CREATE INDEX test_stop_name_fold ON stops (_node_gtfs_casefold_stop_name)',
  );
  await gtfs.database.withKysely({
    callback: async (db) => {
      for (const [predicate, indexName] of [
        [
          sql<boolean>`${sql.ref('stop_name')} glob ${'Market*'}`,
          'test_stop_name',
        ],
        [
          sql<boolean>`${sql.ref('_node_gtfs_casefold_stop_name')} glob ${foldGtfsText('Market') + '*'}`,
          'test_stop_name_fold',
        ],
      ] as const) {
        const plan = await sql<{
          detail: string;
        }>`explain query plan select stop_id from stops where ${predicate}`.execute(
          db,
        );
        assert.ok(
          plan.rows.some(({ detail }) =>
            detail.includes(`USING INDEX ${indexName}`),
          ),
        );
      }
      assert.deepEqual(
        await db
          .selectFrom('stops')
          .where('source_id', '=', 'north')
          .where(
            sql<string>`${sql.ref('_node_gtfs_casefold_stop_name')}`,
            '=',
            foldGtfsText('STRASSE'),
          )
          .select('stop_name')
          .orderBy('stop_name')
          .execute(),
        [{ stop_name: 'STRASSE' }, { stop_name: 'Straße' }],
      );
    },
  });
});
