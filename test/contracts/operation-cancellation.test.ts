import assert from 'node:assert/strict';
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspect } from 'node:util';
import { test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, PostgresDialect, MysqlDialect } from 'kysely';
import pg from 'pg';
import mysql from 'mysql2';
import Cursor from 'pg-cursor';
import type { GtfsDatabase } from '../../src/schema/database.ts';
import {
  Gtfs,
  GtfsErrorCode,
  isGtfsError,
  importGtfs,
  exportGtfs,
  refreshGtfsRealtime,
  type GtfsReportEvent,
} from '../../src/index.ts';
import { createDeferred } from '../helpers/deferred.ts';
import { startTestHttpServer } from '../helpers/http-server.ts';
import { encodeRealtimeFeed } from '../helpers/realtime-feed.ts';

const input = 'test/fixtures/complete';
const reason = new Error('caller requested stop');
async function verifyBorrowedTransactionCancellation(
  database: Kysely<GtfsDatabase>,
) {
  const before = await database
    .selectFrom('routes')
    .selectAll()
    .orderBy('route_id')
    .execute();
  const rollback = new Error('roll back caller work');
  await assert.rejects(
    database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('routes')
        .set({ route_short_name: 'caller pending' })
        .execute();
      const pending = await transaction
        .selectFrom('routes')
        .selectAll()
        .orderBy('route_id')
        .execute();
      const controller = new AbortController();
      let writing = false;
      const nested = new Gtfs<GtfsDatabase>({
        database: { client: transaction },
        sources: [{ sourceId: 'north', schedule: { path: input } }],
        reporting: { level: 'silent' },
      });
      try {
        await assert.rejects(
          nested.import({
            signal: controller.signal,
            reporting: {
              reporter(event) {
                if (
                  event.type === 'status' &&
                  event.message === 'Importing GTFS files'
                ) {
                  writing = true;
                }
                if (
                  writing &&
                  event.type === 'status' &&
                  event.phase === 'complete' &&
                  event.filename === 'agency.txt'
                ) {
                  controller.abort(reason);
                }
              },
            },
          }),
          cancelled,
        );
        assert.deepEqual(
          await transaction
            .selectFrom('routes')
            .selectAll()
            .orderBy('route_id')
            .execute(),
          pending,
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
      .orderBy('route_id')
      .execute(),
    before,
  );
}
for (const dialect of ['postgres', 'mysql'] as const) {
  const url =
    dialect === 'postgres'
      ? process.env.GTFS_TEST_POSTGRES_URL
      : process.env.GTFS_TEST_MYSQL_URL;
  test(
    `${dialect}: cancelled writes roll back and export releases its only pool connection`,
    { skip: url === undefined, timeout: 30_000 },
    async (t) => {
      const directory = await mkdtemp(path.join(tmpdir(), 'cancel-server-'));
      let abortSnapshot: AbortController | undefined;
      let abortStream: AbortController | undefined;
      const database = new Kysely<GtfsDatabase>({
        dialect:
          dialect === 'postgres'
            ? new PostgresDialect({
                pool: new pg.Pool({ connectionString: url!, max: 1 }),
                cursor: Cursor,
              })
            : new MysqlDialect({
                pool: mysql.createPool({ uri: url!, connectionLimit: 1 }),
              }),
        log(event) {
          if (
            event.level === 'query' &&
            /insert into ["`]?realtime_snapshots/iu.test(event.query.sql)
          ) {
            abortSnapshot?.abort(reason);
          }
        },
        plugins: [
          {
            transformQuery({ node }) {
              return node;
            },
            async transformResult({ result }) {
              if (
                result.rows.some(
                  (row) => (row as Record<string, unknown>).route_id === 'FR1',
                )
              ) {
                abortStream?.abort(reason);
              }
              return result;
            },
          },
        ],
      });
      const gtfs = new Gtfs({
        database: { client: database },
        extensions: ['gtfs-realtime'],
        sources: [{ sourceId: 'north', schedule: { path: input } }],
        reporting: { level: 'silent' },
      });
      t.after(async () => {
        await gtfs.close();
        await database.destroy();
        await rm(directory, { recursive: true, force: true });
      });
      await gtfs.schema.recreate();
      await gtfs.import();
      await database
        .updateTable('routes')
        .set({ route_short_name: 'previous' })
        .execute();
      const controller = new AbortController();
      let writing = false;
      await assert.rejects(
        gtfs.import({
          signal: controller.signal,
          reporting: {
            reporter(event) {
              if (
                event.type === 'status' &&
                event.message === 'Importing GTFS files'
              ) {
                writing = true;
              }
              if (
                writing &&
                event.type === 'status' &&
                event.phase === 'complete' &&
                event.filename === 'agency.txt'
              ) {
                controller.abort(reason);
              }
            },
          },
        }),
        cancelled,
      );
      assert.equal(
        (await gtfs.schedule.routes.first())?.route_short_name,
        'previous',
      );

      t.mock.method(
        globalThis,
        'fetch',
        async () =>
          new Response(
            encodeRealtimeFeed({
              incrementality: 'FULL_DATASET',
              timestamp: 1,
              entities: [],
            }),
          ),
      );
      abortSnapshot = new AbortController();
      await assert.rejects(
        gtfs.realtime.refresh({
          signal: abortSnapshot.signal,
          sources: [
            {
              sourceId: 'north',
              realtime: {
                feeds: [{ type: 'alerts', url: 'https://example.test/a' }],
              },
            },
          ],
        }),
        cancelled,
      );
      assert.equal(
        (await database.selectFrom('realtime_snapshots').selectAll().execute())
          .length,
        0,
      );
      abortSnapshot = undefined;

      await verifyBorrowedTransactionCancellation(database);

      await database.transaction().execute(async (transaction) => {
        abortSnapshot = new AbortController();
        const nested = new Gtfs<GtfsDatabase>({
          database: { client: transaction },
          extensions: ['gtfs-realtime'],
        });
        try {
          await assert.rejects(
            nested.realtime.refresh({
              signal: abortSnapshot.signal,
              sources: [
                {
                  sourceId: 'north',
                  realtime: {
                    feeds: [{ type: 'alerts', url: 'https://example.test/a' }],
                  },
                },
              ],
            }),
            cancelled,
          );
          assert.equal(
            (
              await transaction
                .selectFrom('realtime_snapshots')
                .selectAll()
                .execute()
            ).length,
            0,
          );
        } finally {
          await nested.close();
          abortSnapshot = undefined;
        }
      });

      abortStream = new AbortController();
      await assert.rejects(
        gtfs.export({
          signal: abortStream.signal,
          outputDirectory: path.join(directory, 'partial'),
        }),
        cancelled,
      );
      abortStream = undefined;
      assert.deepEqual(await readdir(directory), []);
      assert.equal(await gtfs.schedule.routes.count(), 2);
    },
  );
}

function cancelled(error: unknown): boolean {
  assert.ok(isGtfsError(error));
  assert.equal(error.code, GtfsErrorCode.OPERATION_CANCELLED, inspect(error));
  assert.equal(error.category, 'cancellation');
  assert.strictEqual(error.cause, reason);
  return true;
}

for (const adapter of ['native', 'kysely'] as const) {
  test(`${adapter}: import cancellation stays fatal when rollback also fails`, async (t) => {
    const { gtfs, sqlite } = await fixture(t, adapter);
    const controller = new AbortController();
    const cleanup = new Error('rollback failed');
    const method = adapter === 'native' ? 'exec' : 'prepare';
    const original = sqlite[method].bind(sqlite);
    t.mock.method(sqlite, method, (statement: string) => {
      if (statement.toLowerCase() === 'rollback') {
        throw cleanup;
      }
      return original(statement);
    });
    let writing = false;
    try {
      await assert.rejects(
        gtfs.import({
          signal: controller.signal,
          reporting: {
            reporter(event) {
              if (
                event.type === 'status' &&
                event.message === 'Importing GTFS files'
              ) {
                writing = true;
              }
              if (
                writing &&
                event.type === 'status' &&
                event.phase === 'complete' &&
                event.filename === 'agency.txt'
              ) {
                controller.abort(reason);
              }
            },
          },
        }),
        (error) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.OPERATION_CANCELLED);
          assert.ok(error.cause instanceof AggregateError);
          assert.equal(error.cause.errors.length, 2);
          cancelled(error.cause.errors[0]);
          assert.equal(error.cause.errors[1], cleanup);
          return true;
        },
      );
      assert.equal(sqlite.inTransaction, true);
    } finally {
      t.mock.restoreAll();
      if (sqlite.inTransaction) {
        sqlite.exec('ROLLBACK');
      }
    }
    assert.equal(sqlite.open, true);
  });
}

async function fixture(
  t: TestContext,
  adapter: 'native' | 'kysely' = 'native',
) {
  const directory = await mkdtemp(path.join(tmpdir(), 'cancellation-test-'));
  const previousTemp = process.env.TMPDIR;
  process.env.TMPDIR = directory;
  const sqlite = new Database(':memory:');
  const client = new Kysely<GtfsDatabase>({
    dialect: new SqliteDialect({ database: sqlite }),
  });
  const gtfs = new Gtfs({
    database: { client: adapter === 'native' ? sqlite : client },
    extensions: ['gtfs-realtime'],
    sources: [
      {
        sourceId: 'north',
        schedule: { path: input, import: { onSourceError: 'continue' } },
      },
    ],
    reporting: { level: 'silent' },
  });
  t.after(async () => {
    await gtfs.close();
    await client.destroy();
    if (previousTemp === undefined) {
      delete process.env.TMPDIR;
    } else {
      process.env.TMPDIR = previousTemp;
    }
    await rm(directory, { recursive: true, force: true });
  });
  return { gtfs, sqlite, directory, client };
}

test('cancellation rolls back to a savepoint in a borrowed SQLite Kysely transaction', async (t) => {
  const { gtfs, client } = await fixture(t, 'kysely');
  await gtfs.import();
  await verifyBorrowedTransactionCancellation(client);
});

test('pre-aborted and invalid signals reject before database or output work', async (t) => {
  const { gtfs, sqlite, directory } = await fixture(t);
  const signal = AbortSignal.abort(reason);
  for (const action of [
    () => gtfs.import({ signal }),
    () => gtfs.export({ signal }),
    () =>
      gtfs.realtime.refresh({
        signal,
        sources: [
          {
            sourceId: 'north',
            realtime: {
              feeds: [{ type: 'alerts', url: 'https://example.test/feed' }],
            },
          },
        ],
      }),
    () =>
      importGtfs({
        database: { path: path.join(directory, 'absent.sqlite') },
        sources: [{ schedule: { path: input } }],
        signal,
      }),
    () => exportGtfs({ database: { client: sqlite }, signal }),
    () =>
      refreshGtfsRealtime({
        database: { client: sqlite },
        sources: [],
        signal,
      }),
  ]) {
    await assert.rejects(action, cancelled);
  }
  for (const signal of [{}, null, undefined]) {
    await assert.rejects(gtfs.import({ signal } as never), {
      code: GtfsErrorCode.CONFIG_INVALID,
    });
  }
  assert.deepEqual(sqlite.prepare('SELECT name FROM sqlite_master').all(), []);
  assert.deepEqual(await readdir(directory), []);
});

test('a queued cancellation never starts and does not cancel the next call', async (t) => {
  const { gtfs, directory } = await fixture(t);
  const entered = createDeferred();
  const release = createDeferred();
  t.after(release.resolve);
  const first = gtfs.database.withKysely({
    callback: async () => {
      entered.resolve();
      await release.promise;
    },
  });
  await entered.promise;
  const controller = new AbortController();
  const pending = gtfs.import({ signal: controller.signal });
  const rejected = assert.rejects(pending, cancelled);
  controller.abort(reason);
  await rejected;
  release.resolve();
  await first;
  assert.deepEqual(await readdir(directory), []);
  assert.equal((await gtfs.import()).success, true);
});

for (const adapter of ['native', 'kysely'] as const) {
  for (const phase of [
    'copy',
    'parse',
    'references',
    'delete',
    'write-staged',
    'write-direct',
  ] as const) {
    test(`${adapter}: cancellation during ${phase} preserves the old source and removes staging`, async (t) => {
      const { gtfs, sqlite, directory } = await fixture(t, adapter);
      await gtfs.import();
      sqlite.exec("UPDATE routes SET route_short_name = 'previous'");
      const before = sqlite
        .prepare('SELECT * FROM routes ORDER BY route_id')
        .all();
      const controller = new AbortController();
      const events: GtfsReportEvent[] = [];
      let writing = false;
      const reporter = (event: GtfsReportEvent) => {
        events.push(event);
        if (
          event.type === 'status' &&
          event.message === 'Importing GTFS files'
        ) {
          writing = true;
        }
        const matched =
          (phase === 'copy' &&
            event.type === 'status' &&
            event.message.startsWith('Importing static GTFS')) ||
          (phase === 'parse' &&
            event.type === 'progress' &&
            event.filename !== undefined) ||
          (phase === 'references' &&
            event.type === 'status' &&
            event.message === 'Checking references between files') ||
          (phase === 'delete' &&
            event.type === 'status' &&
            event.message.startsWith('Deleted existing schedule data')) ||
          (phase.startsWith('write') &&
            writing &&
            event.type === 'status' &&
            event.phase === 'complete' &&
            event.filename === 'agency.txt');
        if (matched) {
          controller.abort(reason);
        }
      };
      await assert.rejects(
        gtfs.import({
          signal: controller.signal,
          validation: { mode: phase === 'write-direct' ? 'off' : 'permissive' },
          reporting: { reporter },
        }),
        cancelled,
      );
      assert.equal(controller.signal.aborted, true);
      assert.deepEqual(
        sqlite.prepare('SELECT * FROM routes ORDER BY route_id').all(),
        before,
      );
      assert.equal(sqlite.inTransaction, false);
      assert.deepEqual(await readdir(directory), []);
      assert.equal(
        events.filter((event) => event.type === 'operation:complete').length,
        0,
      );
      const cancellation = events.filter(
        (event) =>
          event.type === 'message' &&
          event.error?.code === GtfsErrorCode.OPERATION_CANCELLED,
      );
      assert.equal(cancellation.length, 1);
      assert.equal(cancellation[0]?.operationId, events[0]?.operationId);
      assert.equal((await gtfs.import()).success, true);
    });
  }

  test(`${adapter}: cancelled export releases its cursor and preserves previous output`, async (t) => {
    const { gtfs, sqlite, directory } = await fixture(t, adapter);
    await gtfs.import();
    const outputDirectory = path.join(directory, 'output');
    await mkdir(outputDirectory);
    await writeFile(path.join(outputDirectory, 'previous.txt'), 'keep this');
    const controller = new AbortController();
    const events: GtfsReportEvent[] = [];
    const prepare = sqlite.prepare.bind(sqlite);
    let cursorClosed = false;
    t.mock.method(sqlite, 'prepare', (query: string) => {
      const statement = prepare(query);
      if (query.includes('from "routes"')) {
        const iterate = statement.iterate.bind(statement);
        t.mock.method(
          statement,
          'iterate',
          function* (...parameters: unknown[]) {
            try {
              for (const row of iterate(...parameters)) {
                controller.abort(reason);
                yield row;
              }
            } finally {
              cursorClosed = true;
            }
          },
        );
      }
      return statement;
    });
    await assert.rejects(
      gtfs.export({
        outputDirectory,
        overwrite: true,
        signal: controller.signal,
        reporting: { reporter: (event) => events.push(event) },
      }),
      cancelled,
    );
    assert.equal(cursorClosed, true);
    assert.equal(
      await readFile(path.join(outputDirectory, 'previous.txt'), 'utf8'),
      'keep this',
    );
    assert.deepEqual(await readdir(directory), ['output']);
    assert.deepEqual(await readdir(outputDirectory), ['previous.txt']);
    const cancellation = events.find(
      (event) =>
        event.type === 'message' &&
        event.error?.code === GtfsErrorCode.OPERATION_CANCELLED,
    );
    assert.equal(cancellation?.operationId, events[0]?.operationId);
    assert.equal(await gtfs.schedule.routes.count(), 2);
  });

  test(`${adapter}: cancelled Realtime snapshot rolls back its writes`, async (t) => {
    const { gtfs, sqlite } = await fixture(t, adapter);
    const controller = new AbortController();
    const sources = [
      {
        sourceId: 'north',
        realtime: {
          feeds: [
            { type: 'alerts' as const, url: 'https://example.test/alerts' },
          ],
        },
      },
    ];
    let timestamp = 1;
    t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(
          encodeRealtimeFeed({
            incrementality: 'FULL_DATASET',
            timestamp: timestamp++,
            entities: [
              {
                id: 'notice',
                alert: {
                  headerText: { translation: [{ text: 'original' }] },
                  descriptionText: { translation: [{ text: 'description' }] },
                },
              },
            ],
          }),
        ),
    );
    await gtfs.realtime.refresh({ sources });
    const before = sqlite.prepare('SELECT * FROM realtime_snapshots').all();
    const original = sqlite.prepare.bind(sqlite);
    let writing = false;
    t.mock.method(sqlite, 'prepare', (query: string) => {
      const statement = original(query);
      if (/insert into ["`]?realtime_snapshots/iu.test(query)) {
        const run = statement.run.bind(statement);
        t.mock.method(statement, 'run', (...parameters: unknown[]) => {
          const result = run(...parameters);
          writing = true;
          controller.abort(reason);
          return result;
        });
      }
      return statement;
    });
    await assert.rejects(
      gtfs.realtime.refresh({ sources, signal: controller.signal }),
      cancelled,
    );
    assert.equal(writing, true);
    assert.deepEqual(
      sqlite.prepare('SELECT * FROM realtime_snapshots').all(),
      before,
    );
    assert.equal(sqlite.inTransaction, false);
    assert.equal(await gtfs.realtime.alerts.count(), 1);
  });
}

test(
  'caller cancellation stops a stalled download body and preserves its reason',
  { timeout: 10_000 },
  async (t) => {
    const { gtfs, directory } = await fixture(t);
    const bodyStarted = createDeferred();
    const url = await startTestHttpServer(t, (_request, response) => {
      response.writeHead(200);
      response.write('partial ZIP');
      bodyStarted.resolve();
    });
    const controller = new AbortController();
    const pending = gtfs.import({
      signal: controller.signal,
      sources: [{ sourceId: 'north', schedule: { url, timeoutMs: 60_000 } }],
    });
    const rejected = assert.rejects(pending, cancelled);
    await bodyStarted.promise;
    controller.abort(reason);
    await rejected;
    assert.deepEqual(await readdir(directory), []);
  },
);

test('Realtime retry backoff is cancellable and does not issue another request', async (t) => {
  const { gtfs } = await fixture(t);
  const controller = new AbortController();
  const fetch = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 503 }),
  );
  await assert.rejects(
    gtfs.realtime.refresh({
      signal: controller.signal,
      sources: [
        {
          sourceId: 'north',
          realtime: {
            feeds: [{ type: 'alerts', url: 'https://example.test/feed' }],
          },
        },
      ],
      reporting: {
        reporter(event) {
          if (event.type === 'message' && event.message.includes('retrying')) {
            controller.abort(reason);
          }
        },
      },
    }),
    cancelled,
  );
  assert.equal(fetch.mock.callCount(), 1);
});

test('standalone auto-detection propagates cancellation and cleans up', async (t) => {
  const { sqlite, directory } = await fixture(t);
  const controller = new AbortController();
  await assert.rejects(
    importGtfs({
      database: { client: sqlite },
      extensions: 'auto',
      sources: [{ schedule: { path: input } }],
      signal: controller.signal,
      reporting: {
        reporter(event) {
          if (
            event.type === 'status' &&
            event.message.startsWith('Importing static GTFS')
          ) {
            controller.abort(reason);
          }
        },
      },
    }),
    cancelled,
  );
  assert.deepEqual(await readdir(directory), []);
  assert.equal(sqlite.open, true);
});

test('a non-aborted signal preserves validation counts and notice order across batch boundaries', async (t) => {
  const { gtfs, directory } = await fixture(t);
  const source = path.join(directory, 'input');
  await cp(input, source, { recursive: true });
  await rm(path.join(source, 'shapes.txt'));
  await writeFile(
    path.join(source, 'routes.txt'),
    'route_id,agency_id,route_type,continuous_pickup\nFR1,FA1,3,0\n',
  );
  await writeFile(
    path.join(source, 'trips.txt'),
    'route_id,service_id,trip_id,shape_id\n' +
      Array.from(
        { length: 1025 },
        (_, index) => `FR1,FS1,trip${index},\n`,
      ).join(''),
  );
  const readNotices = async (signal?: AbortSignal) => {
    const notices: unknown[] = [];
    const result = await gtfs.import({
      ...(signal === undefined ? {} : { signal }),
      sources: [{ sourceId: 'north', schedule: { path: source } }],
      validation: { mode: 'permissive' },
      reporting: {
        reporter(event) {
          if (event.type === 'validation:notice') {
            notices.push(event.notice);
          }
        },
      },
    });
    assert.equal(result.success, true);
    return notices;
  };
  const baseline = await readNotices();
  assert.ok(baseline.length > 1025);
  assert.deepEqual(await readNotices(new AbortController().signal), baseline);
  const controller = new AbortController();
  let delivered = 0;
  await assert.rejects(
    gtfs.import({
      signal: controller.signal,
      sources: [{ sourceId: 'north', schedule: { path: source } }],
      validation: { mode: 'permissive' },
      reporting: {
        reporter(event) {
          if (event.type === 'validation:notice') {
            delivered += 1;
            if (delivered === 1) {
              setImmediate(() => controller.abort(reason));
            }
          }
        },
      },
    }),
    cancelled,
  );
  assert.equal(delivered, 512);
});

test('cancelling a later source retains earlier commits and ignores onSourceError continue', async (t) => {
  const { sqlite, directory } = await fixture(t);
  const controller = new AbortController();
  await assert.rejects(
    importGtfs({
      database: { client: sqlite },
      signal: controller.signal,
      sources: ['first', 'second'].map((sourceId) => ({
        sourceId,
        schedule: {
          path: input,
          import: { onSourceError: 'continue' as const },
        },
      })),
      reporting: {
        reporter(event) {
          if (event.type === 'progress' && event.sourceId === 'second') {
            controller.abort(reason);
          }
        },
      },
    }),
    cancelled,
  );
  assert.deepEqual(
    sqlite
      .prepare(
        'SELECT source_id, count(*) AS count FROM routes GROUP BY source_id',
      )
      .all(),
    [{ source_id: 'first', count: 2 }],
  );
  assert.deepEqual(await readdir(directory), []);
});

test('ZIP cancellation closes the archive and removes extracted files', async (t) => {
  const { gtfs, directory } = await fixture(t);
  const controller = new AbortController();
  await assert.rejects(
    gtfs.import({
      signal: controller.signal,
      sources: [
        {
          sourceId: 'north',
          schedule: { path: 'test/fixtures/caltrain_20160406.zip' },
        },
      ],
      reporting: {
        reporter(event) {
          if (
            event.type === 'status' &&
            event.message.startsWith('Importing static GTFS')
          ) {
            setImmediate(() => controller.abort(reason));
          }
        },
      },
    }),
    cancelled,
  );
  assert.deepEqual(await readdir(directory), []);
});

test(
  'download timeout remains a download failure with a non-aborted caller signal',
  { timeout: 10_000 },
  async (t) => {
    const { gtfs, directory } = await fixture(t);
    const controller = new AbortController();
    const url = await startTestHttpServer(t, () => {});
    await assert.rejects(
      gtfs.import({
        signal: controller.signal,
        sources: [{ sourceId: 'north', schedule: { url, timeoutMs: 10 } }],
      }),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.DOWNLOAD_FAILED);
        assert.match(error.message, /timed out/);
        assert.equal(controller.signal.aborted, false);
        return true;
      },
    );
    assert.deepEqual(await readdir(directory), []);
  },
);

test('an abort after export publication does not turn success into cancellation', async (t) => {
  const { gtfs, sqlite, directory } = await fixture(t);
  await gtfs.import();
  const controller = new AbortController();
  const outputDirectory = path.join(directory, 'published');
  const result = await exportGtfs({
    database: { client: sqlite },
    export: { outputDirectory },
    signal: controller.signal,
    reporting: {
      reporter(event) {
        if (event.type === 'operation:complete') {
          controller.abort(reason);
        }
      },
    },
  });
  assert.equal(controller.signal.aborted, true);
  assert.equal(result.outputDirectory, outputDirectory);
  assert.ok((await readdir(outputDirectory)).includes('routes.txt'));
  assert.deepEqual(await readdir(directory), ['published']);
});
