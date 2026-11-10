import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Kysely, SqliteDialect } from 'kysely';

import * as root from '../../dist/index.js';
import * as kysely from '../../dist/kysely.js';
import * as schema from '../../dist/schema/index.js';
import * as sqlite from '../../dist/sqlite.js';
import expected from '../fixtures/public-exports.json' with { type: 'json' };

describe('public package exports', () => {
  test('low-level inspection and cleanup require a named database before SQL', async (t) => {
    const native = sqlite.openSqliteDatabase({ path: ':memory:' });
    const database = new Kysely({
      dialect: new SqliteDialect({ database: native }),
    });
    t.after(() => database.destroy());
    const prepare = t.mock.method(native, 'prepare', () => {
      throw new Error('Unexpected SQL');
    });
    for (const { operation, client, wrongClient, options } of [
      {
        operation: sqlite.inspectSqliteGtfsSchema,
        client: native,
        wrongClient: database,
        options: {},
      },
      {
        operation: kysely.inspectKyselyGtfsSchema,
        client: database,
        wrongClient: native,
        options: { dialect: 'sqlite' },
      },
      {
        operation: kysely.cleanupGtfsRealtime,
        client: database,
        wrongClient: native,
        options: { extensions: ['gtfs-realtime'] },
      },
    ]) {
      for (const args of [
        [],
        [undefined],
        [null],
        [[]],
        [client],
        [client, options],
      ]) {
        await assert.rejects(
          async () => Reflect.apply(operation, undefined, args),
          {
            code: root.GtfsErrorCode.CONFIG_INVALID,
            message: /accepts one named options object/u,
          },
        );
      }
      for (const invalidDatabase of [undefined, null, {}, wrongClient]) {
        await assert.rejects(
          async () =>
            Reflect.apply(operation, undefined, [
              { ...options, database: invalidDatabase },
            ]),
          {
            code: root.GtfsErrorCode.CONFIG_INVALID,
            details: { method: `${operation.name}()`, path: 'database' },
          },
        );
      }
      await assert.rejects(
        async () => Reflect.apply(operation, undefined, [options]),
        {
          code: root.GtfsErrorCode.CONFIG_INVALID,
          details: { method: `${operation.name}()`, path: 'database' },
        },
      );
    }
    assert.equal(prepare.mock.callCount(), 0);
  });

  test('schema inspectors reject table subsets before SQL', async (t) => {
    const native = sqlite.openSqliteDatabase({ path: ':memory:' });
    const database = new Kysely({
      dialect: new SqliteDialect({ database: native }),
    });
    t.after(() => database.destroy());
    const prepare = t.mock.method(native, 'prepare', () => {
      throw new Error('Unexpected SQL');
    });
    for (const tables of [[], [schema.gtfsManifest.agency], undefined]) {
      assert.throws(
        () =>
          sqlite.inspectSqliteGtfsSchema({ database: native, tables } as never),
        {
          code: root.GtfsErrorCode.CONFIG_INVALID,
          details: {
            method: 'inspectSqliteGtfsSchema()',
            reason: 'unknown-option',
            path: 'tables',
          },
        },
      );
      for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
        await assert.rejects(
          kysely.inspectKyselyGtfsSchema({
            database,
            dialect,
            tables,
          } as never),
          {
            code: root.GtfsErrorCode.CONFIG_INVALID,
            details: {
              method: 'inspectKyselyGtfsSchema()',
              reason: 'unknown-option',
              path: 'tables',
            },
          },
        );
      }
    }
    assert.equal(prepare.mock.callCount(), 0);
  });

  test('matches the checked-in root and backend snapshots', () => {
    assert.deepEqual(Object.keys(root).sort(), expected.root);
    assert.deepEqual(Object.keys(sqlite).sort(), expected.sqlite);
    assert.deepEqual(Object.keys(kysely).sort(), expected.kysely);
  });
});
