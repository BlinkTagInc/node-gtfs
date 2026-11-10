import assert from 'node:assert/strict';
import type Database from 'better-sqlite3';
import type { Kysely } from 'kysely';
import fc from 'fast-check';
import { Gtfs } from '../../../src/index.ts';
import type { GtfsDatabase } from '../../../src/schema/database.ts';
import { propertyOptions } from '../../helpers/property-options.ts';

const description = fc.constantFrom(
  null,
  '',
  'null',
  'Red',
  'red',
  ' ',
  "quote'",
  '%_',
  '東京',
);
const row = fc.record({
  source_id: fc.constantFrom('north', 'south'),
  route_desc: description,
  route_type: fc.constantFrom(0, 3),
});

export async function verifyNullableProperties(
  db: Kysely<GtfsDatabase>,
  native?: Database.Database,
) {
  const gtfs = new Gtfs({
    database: { client: native ?? db },
    sources: [{ sourceId: 'north' }],
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.recreate();
    await fc.assert(
      fc.asyncProperty(
        fc.array(row, { maxLength: 12 }),
        description,
        description,
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        async (generated, first, second, limit, offset) => {
          const rows = [
            { source_id: 'north', route_desc: null, route_type: 3 },
            { source_id: 'north', route_desc: '', route_type: 3 },
            { source_id: 'south', route_desc: null, route_type: 3 },
            ...generated,
          ].map((value, index) => ({
            ...value,
            route_id: String(index).padStart(2, '0'),
          }));
          await db.deleteFrom('routes').execute();
          await db.insertInto('routes').values(rows).execute();
          const scoped = rows.filter((value) => value.source_id === 'north');
          const expected = scoped
            .filter((value) => value.route_desc === first)
            .map(({ route_id, route_desc }) => ({ route_id, route_desc }));
          const query = gtfs.schedule.routes
            .where({ route_desc: first })
            .select('route_id', 'route_desc')
            .orderBy([{ field: 'route_id', direction: 'asc' }]);
          assert.deepEqual(await query.all(), expected);
          assert.equal(await query.count(), expected.length);
          assert.deepEqual(await query.first(), expected[0] ?? null);
          const streamed = [];
          for await (const value of query.stream()) {
            streamed.push(value);
          }
          assert.deepEqual(streamed, expected);
          assert.deepEqual(
            await query.limit(limit).offset(offset).all(),
            expected.slice(offset, offset + limit),
          );
          assert.deepEqual(
            await query.where({ route_desc: second }).all(),
            first === second ? expected : [],
          );
          assert.equal(
            await gtfs.schedule.routes.where({}).count(),
            scoped.length,
          );
          await assert.rejects(
            async () =>
              gtfs.schedule.routes
                .where({ route_desc: undefined } as never)
                .all(),
            {
              code: 'GTFS_QUERY_INVALID',
            },
          );
        },
      ),
      propertyOptions(13006, 40),
    );
  } finally {
    await gtfs.close();
  }
}
