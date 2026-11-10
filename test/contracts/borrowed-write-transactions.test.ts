import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, PostgresDialect, MysqlDialect } from 'kysely';
import pg from 'pg';
import mysql from 'mysql2';
import { Gtfs, GtfsErrorCode, isGtfsError } from '../../src/index.ts';
import type { GtfsDatabase } from '../../src/schema/database.ts';
import { encodeRealtimeFeed } from '../helpers/realtime-feed.ts';

for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  const url =
    dialect === 'postgres'
      ? process.env.GTFS_TEST_POSTGRES_URL
      : process.env.GTFS_TEST_MYSQL_URL;
  test(
    `${dialect}: borrowed transactions roll back failed source replacements and snapshots without a signal`,
    {
      skip: dialect !== 'sqlite' && url === undefined,
      timeout: 30_000,
    },
    async (t) => {
      const directory = await mkdtemp(path.join(tmpdir(), 'borrowed-write-'));
      let routeInsertStatements = 0;
      const database = new Kysely<GtfsDatabase>({
        log(event) {
          if (
            event.level === 'query' &&
            /insert into ["`]?routes["`]? /iu.test(event.query.sql)
          ) {
            routeInsertStatements += 1;
          }
        },
        dialect:
          dialect === 'sqlite'
            ? new SqliteDialect({ database: new Database(':memory:') })
            : dialect === 'postgres'
              ? new PostgresDialect({
                  pool: new pg.Pool({ connectionString: url!, max: 1 }),
                })
              : new MysqlDialect({
                  pool: mysql.createPool({ uri: url!, connectionLimit: 1 }),
                }),
      });
      const gtfs = new Gtfs<GtfsDatabase>({
        database: { client: database },
        extensions: ['gtfs-realtime'],
        reporting: { level: 'silent' },
      });
      t.after(async () => {
        await gtfs.close();
        await database.destroy();
        await rm(directory, { recursive: true, force: true });
      });
      await gtfs.schema.recreate();
      const source = (sourceId: string, mode: 'off' | 'permissive') => ({
        sourceId,
        schedule: {
          path: directory,
          import: {
            onSourceError: 'continue' as const,
            validation: { mode, onUnknownField: 'preserve' as const },
          },
        },
      });
      await writeFile(
        path.join(directory, 'routes.txt'),
        'route_id,route_type\nold,3\n',
      );
      await writeFile(
        path.join(directory, 'stops.txt'),
        'stop_id,stop_lat\nold,0\n',
      );
      assert.equal(
        (
          await gtfs.import({
            sources: [source('target', 'off'), source('other', 'off')],
          })
        ).success,
        true,
      );
      const original = await database
        .selectFrom('routes')
        .selectAll()
        .orderBy('source_id')
        .execute();
      await writeFile(
        path.join(directory, 'routes.txt'),
        'route_id,route_type\n' +
          Array.from({ length: 1001 }, (_, index) => `new-${index},3\n`).join(
            '',
          ),
      );
      await writeFile(
        path.join(directory, 'stops.txt'),
        'stop_id,stop_lat\ninvalid,91\n',
      );

      for (const mode of ['off', 'permissive'] as const) {
        await t.test(
          `${mode} failure preserves earlier caller writes and other sources`,
          async () => {
            const rollback = new Error('caller rolls back its own work');
            await assert.rejects(
              database.transaction().execute(async (transaction) => {
                await transaction
                  .updateTable('routes')
                  .set({ route_short_name: 'caller pending' })
                  .where('source_id', '=', 'target')
                  .execute();
                const pending = await transaction
                  .selectFrom('routes')
                  .selectAll()
                  .orderBy('source_id')
                  .execute();
                const nested = new Gtfs<GtfsDatabase>({
                  database: { client: transaction },
                  extensions: ['gtfs-realtime'],
                  reporting: { level: 'silent' },
                });
                try {
                  const statementsBefore = routeInsertStatements;
                  const result = await nested.import({
                    sources: [source('target', mode)],
                  });
                  assert.equal(result.success, false);
                  assert.equal(result.sources[0]?.success, false);
                  assert.equal(
                    result.sources[0]?.error?.code,
                    GtfsErrorCode.DATABASE_OPERATION_FAILED,
                  );
                  assert.equal(
                    result.sources[0]?.error?.details?.sourceId,
                    'target',
                  );
                  assert.equal(
                    result.sources[0]?.error?.details?.filename,
                    'stops.txt',
                  );
                  assert.equal(
                    result.sources[0]?.files.find(
                      ({ filename }) => filename === 'routes.txt',
                    )?.rowsInserted,
                    0,
                  );
                  assert.ok(
                    routeInsertStatements - statementsBefore >= 2,
                    'replacement completed multiple insert chunks before failing',
                  );
                  assert.deepEqual(
                    await transaction
                      .selectFrom('routes')
                      .selectAll()
                      .orderBy('source_id')
                      .execute(),
                    pending,
                  );
                  assert.deepEqual(
                    await transaction
                      .selectFrom('stops')
                      .select(['source_id', 'stop_id'])
                      .orderBy('source_id')
                      .execute(),
                    [
                      { source_id: 'other', stop_id: 'old' },
                      { source_id: 'target', stop_id: 'old' },
                    ],
                  );
                } finally {
                  await nested.close();
                }
                throw rollback;
              }),
              (error: unknown) => error === rollback,
            );
            assert.deepEqual(
              await database
                .selectFrom('routes')
                .selectAll()
                .orderBy('source_id')
                .execute(),
              original,
            );
          },
        );
      }

      await t.test(
        'snapshot write failure leaves the caller transaction usable',
        async () => {
          t.mock.method(
            globalThis,
            'fetch',
            async () =>
              new Response(
                encodeRealtimeFeed({
                  timestamp: 1,
                  incrementality: 'FULL_DATASET',
                  entities: [],
                }),
              ),
          );
          const failure = new Error('fail after snapshot insert');
          await database.transaction().execute(async (transaction) => {
            const snapshots = new Set<object>();
            let inserted = false;
            const client = transaction.withPlugin({
              transformQuery({ node, queryId }) {
                if (
                  /insert into ["`]?realtime_snapshots/iu.test(
                    database.getExecutor().compileQuery(node, queryId).sql,
                  )
                ) {
                  snapshots.add(queryId);
                }
                return node;
              },
              async transformResult({ result, queryId }) {
                if (snapshots.delete(queryId)) {
                  inserted = true;
                  throw failure;
                }
                return result;
              },
            });
            const nested = new Gtfs<GtfsDatabase>({
              database: { client },
              extensions: ['gtfs-realtime'],
              reporting: { level: 'silent' },
            });
            try {
              await assert.rejects(
                nested.realtime.refresh({
                  sources: [
                    {
                      sourceId: 'target',
                      realtime: {
                        feeds: [
                          {
                            type: 'alerts',
                            url: 'https://example.test/alerts',
                          },
                        ],
                      },
                    },
                  ],
                }),
                (error: unknown) => {
                  assert.ok(isGtfsError(error));
                  assert.equal(
                    error.code,
                    GtfsErrorCode.DATABASE_OPERATION_FAILED,
                  );
                  assert.equal(error.cause, failure);
                  return true;
                },
              );
              assert.equal(inserted, true);
              assert.equal(
                (
                  await transaction
                    .selectFrom('realtime_snapshots')
                    .selectAll()
                    .execute()
                ).length,
                0,
              );
              assert.equal(
                (
                  await transaction
                    .selectFrom('realtime_feeds')
                    .selectAll()
                    .execute()
                ).length,
                0,
              );
              assert.deepEqual(
                await transaction
                  .selectFrom('routes')
                  .selectAll()
                  .orderBy('source_id')
                  .execute(),
                original,
              );
            } finally {
              await nested.close();
            }
          });
        },
      );

      if (dialect === 'mysql') {
        await t.test(
          'missing schema is rejected without implicitly committing caller writes',
          async () => {
            await database.schema.dropTable('stops').execute();
            const rollback = new Error('caller rollback');
            await assert.rejects(
              database.transaction().execute(async (transaction) => {
                await transaction
                  .updateTable('routes')
                  .set({ route_short_name: 'uncommitted' })
                  .execute();
                const nested = new Gtfs<GtfsDatabase>({
                  database: { client: transaction },
                  reporting: { level: 'silent' },
                });
                try {
                  await assert.rejects(
                    nested.import({ sources: [source('target', 'off')] }),
                    (error: unknown) => {
                      assert.ok(isGtfsError(error));
                      assert.equal(error.code, GtfsErrorCode.SCHEMA_INVALID);
                      return true;
                    },
                  );
                } finally {
                  await nested.close();
                }
                throw rollback;
              }),
              (error: unknown) => error === rollback,
            );
            assert.deepEqual(
              await database
                .selectFrom('routes')
                .selectAll()
                .orderBy('source_id')
                .execute(),
              original,
            );
          },
        );
      }
    },
  );
}
