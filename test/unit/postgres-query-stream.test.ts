import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  Kysely,
  PostgresDialect,
  type PostgresCursor,
  type PostgresQueryResult,
} from 'kysely';
import { streamPortableQueryRows } from '../../src/database/kysely/query/execute.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import { GtfsError } from '../../src/diagnostics/errors.ts';

for (const mode of [
  'complete',
  'break',
  'failure',
  'missing-cursor',
] as const) {
  test(`PostgreSQL driver streaming with a simulated cursor: ${mode}`, async () => {
    const reads: number[] = [];
    let closed = 0;
    let released = 0;
    let submitted = 0;
    const failure = new Error('Cursor read failed');
    class Cursor<Row> implements PostgresCursor<Row> {
      #position = 0;
      constructor(query: string, parameters: unknown[]) {
        assert.match(query, /select "trip_id" as "trip_id" from "trips"/);
        assert.deepEqual(parameters, ['north']);
      }
      async read(count: number): Promise<Row[]> {
        reads.push(count);
        if (mode === 'failure' && this.#position > 0) {
          throw failure;
        }
        return Array.from(
          { length: Math.min(count, 2500 - this.#position) },
          () => ({ trip_id: String(this.#position++) }) as Row,
        );
      }
      async close() {
        closed += 1;
      }
    }
    function query<Row>(cursor: PostgresCursor<Row>): PostgresCursor<Row>;
    function query<Row>(
      text: string,
      parameters: readonly unknown[],
    ): Promise<PostgresQueryResult<Row>>;
    function query<Row>(
      input: string | PostgresCursor<Row>,
    ): Promise<PostgresQueryResult<Row>> | PostgresCursor<Row> {
      submitted += 1;
      assert.notEqual(
        typeof input,
        'string',
        'Streaming must not execute a buffered query',
      );
      return input as PostgresCursor<Row>;
    }
    const database = new Kysely({
      dialect: new PostgresDialect({
        pool: {
          options: {},
          async connect() {
            return {
              query,
              release() {
                released += 1;
              },
            };
          },
          async end() {},
        },
        ...(mode === 'missing-cursor' ? {} : { cursor: Cursor }),
      }),
    });
    try {
      const rows = streamPortableQueryRows(
        {
          database,
          dialect: 'postgres',
          table: compiledTableRegistry.trips,
          sourceIds: ['north'],
        },
        { select: ['trip_id'] },
      );
      assert.equal(submitted, 0);
      if (mode === 'missing-cursor') {
        await assert.rejects(() => rows.next(), {
          code: 'GTFS_QUERY_INVALID',
          details: {
            table: 'trips',
            dialect: 'postgres',
            reason: 'STREAMING_NOT_CONFIGURED',
          },
        });
        assert.equal(submitted, 0);
        assert.equal(released, 1);
        return;
      }
      assert.deepEqual((await rows.next()).value, { trip_id: '0' });
      assert.deepEqual(reads, [1000]);
      for (let index = 1; index < 1000; index += 1) {
        await rows.next();
      }
      assert.deepEqual(reads, [1000]);
      if (mode === 'failure') {
        await assert.rejects(
          () => rows.next(),
          (error) => {
            assert.ok(error instanceof GtfsError);
            assert.equal(error.code, 'GTFS_DATABASE_OPERATION_FAILED');
            assert.equal(error.cause, failure);
            return true;
          },
        );
      } else if (mode === 'complete') {
        const remaining = [];
        for await (const row of rows) {
          remaining.push(row);
        }
        assert.deepEqual(
          remaining,
          Array.from({ length: 1500 }, (_, index) => ({
            trip_id: String(index + 1000),
          })),
        );
      } else {
        assert.deepEqual((await rows.next()).value, { trip_id: '1000' });
        await rows.return?.();
      }
      assert.deepEqual(
        reads,
        mode === 'complete' ? [1000, 1000, 1000, 1000] : [1000, 1000],
      );
      assert.equal(submitted, 1);
      assert.equal(closed, 1);
      assert.equal(released, 1);
    } finally {
      await database.destroy();
    }
  });
}
