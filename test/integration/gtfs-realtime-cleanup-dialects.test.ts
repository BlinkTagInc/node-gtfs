import { createDummyDialect } from '../helpers/kysely-dialect.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Kysely, type LogEvent } from 'kysely';

import { cleanupGtfsRealtime } from '../../src/kysely.ts';

describe('GTFS-Realtime cleanup dialect compilation', () => {
  for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
    test(`${dialect} compiler binds expiration and source scope using a dummy driver`, async () => {
      const queries: LogEvent[] = [];
      const database = new Kysely<Record<string, Record<string, unknown>>>({
        dialect: createDummyDialect(dialect),
        log(event) {
          if (event.level === 'query') {
            queries.push(event);
          }
        },
      });
      try {
        const result = await cleanupGtfsRealtime({
          database,
          nowUnixSeconds: 1_234,
          extensions: ['gtfs-realtime'],
          sourceIds: ['clock-source'],
        });
        assert.equal(result.nowUnixSeconds, 1_234);
        assert.equal(result.totalRowsDeleted, 0);

        const statements = queries.map((event) => event.query);
        assert.equal(statements.length, 11);
        for (const statement of statements) {
          assert.equal(statement.parameters.includes(1_234), true);
          assert.equal(statement.parameters.includes('clock-source'), true);
        }
        assert.match(statements[0]!.sql, /delete from/iu);
        assert.match(statements[0]!.sql, /not exists/iu);
        assert.match(statements.at(-1)?.sql ?? '', /realtime_snapshots/iu);
      } finally {
        await database.destroy();
      }
    });
  }
});
