import type { TestRepository } from '../helpers/query-test-types.ts';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { describe, test } from 'node:test';
import Database from 'better-sqlite3';
import { fixtureExtensions } from '../fixtures/extensions.ts';
import { sql } from 'kysely';
import {
  Gtfs,
  GtfsErrorCategory,
  GtfsErrorCode,
  importGtfs,
  isGtfsError,
  type GtfsReportEvent,
} from '../../src/index.ts';
const fixturePath = 'test/fixtures/caltrain_20160406.zip';
function createGate() {
  let release: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  assert.ok(release);
  return { promise, release };
}
describe('Gtfs instance operations', () => {
  test('rejects malformed operation options before starting work', async (t) => {
    const statements: unknown[] = [];
    const events: GtfsReportEvent[] = [];
    const sqlite = new Database(':memory:', {
      verbose: (statement) => statements.push(statement),
    });
    const fetch = t.mock.method(globalThis, 'fetch', async () => {
      assert.fail('Invalid calls must not fetch feeds');
    });
    const gtfs = new Gtfs({
      database: { client: sqlite },
      extensions: ['gtfs-realtime'],
      sources: [
        {
          schedule: { path: fixturePath },
          realtime: {
            feeds: [{ type: 'alerts', url: 'https://example.test/feed.pb' }],
          },
        },
      ],
      reporting: { reporter: (event) => events.push(event) },
    });
    const initialStatements = statements.slice();
    const initialEvents = events.slice();
    const cases: readonly [string, readonly unknown[]][] = [
      ['undefined', [undefined]],
      ['null', [null]],
      ['array', [[]]],
      ['boolean', [false]],
      ['number', [1]],
      ['string', ['invalid']],
      ['per-call options', [{ sources: [] }]],
      ['multiple arguments', [undefined, {}]],
    ];
    try {
      for (const [name, operation, receiver] of [
        ['import', gtfs.import, gtfs],
        ['realtime.refresh', gtfs.realtime.refresh, gtfs.realtime],
      ] as const) {
        for (const [label, args] of cases) {
          await t.test(`${name}: ${label}`, async () => {
            const result = Reflect.apply(operation, receiver, args);
            assert.ok(result instanceof Promise);
            await assert.rejects(
              async () => result,
              (error: unknown) => {
                assert.ok(isGtfsError(error));
                assert.equal(error.code, GtfsErrorCode.CONFIG_INVALID);
                assert.equal(error.category, GtfsErrorCategory.CONFIG);
                return true;
              },
            );
            assert.deepEqual(statements, initialStatements);
            assert.deepEqual(events, initialEvents);
            assert.equal(fetch.mock.callCount(), 0);
          });
        }
      }
      assert.equal(
        await gtfs.database.withKysely({ callback: () => 'queue recovered' }),
        'queue recovered',
      );
    } finally {
      await gtfs.close();
      sqlite.close();
    }
  });
  test('serializes import, repositories, and export on one connection', async () => {
    const sqlite = new Database(':memory:');
    const outputDirectory = await mkdtemp(
      path.join(tmpdir(), 'gtfs-instance-export-'),
    );
    const gtfs = new Gtfs({
      database: { client: sqlite },
      sources: [
        {
          sourceId: 'caltrain',
          schedule: { path: fixturePath },
        },
      ],
    });
    try {
      const importing = gtfs.import();
      const routeCount = gtfs.schedule.routes.count();
      const [result, count] = await Promise.all([importing, routeCount]);
      assert.equal('success' in result && result.success, true);
      assert.equal(count, 4);
      const exported = await gtfs.export({
        outputDirectory,
        batchSize: 2,
        overwrite: true,
      });
      assert.equal(exported.sourceId, 'caltrain');
      assert.equal(exported.outputDirectory, path.resolve(outputDirectory));
      assert.deepEqual(
        exported.files.find((file) => file.filename === 'routes.txt'),
        { filename: 'routes.txt', recordCount: 4 },
      );
      assert.equal(
        (
          sqlite.prepare('select count(*) as count from routes').get() as {
            count: number;
          }
        ).count,
        4,
      );
    } finally {
      await gtfs.close();
      assert.equal(sqlite.open, true);
      sqlite.close();
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });
  test('exposes Realtime operations and rejects missing configured feeds', async () => {
    const gtfs = new Gtfs({
      database: {},
      extensions: ['gtfs-realtime'],
      sources: [{ sourceId: 'query-only' }],
    });
    try {
      assert.equal(typeof gtfs.realtime.refresh, 'function');
      assert.equal(typeof gtfs.realtime.cleanup, 'function');
      await assert.rejects(
        async () => gtfs.realtime.refresh(),
        (error: unknown) =>
          (
            error as {
              code?: unknown;
            }
          ).code === GtfsErrorCode.CONFIG_INVALID,
      );
    } finally {
      await gtfs.close();
    }
  });
  test('rejects a disabled Realtime operation before fetching', async () => {
    const originalFetch = globalThis.fetch;
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      throw new Error('unexpected fetch');
    }) as typeof fetch;
    const gtfs = new Gtfs({
      database: {},
      sources: [
        {
          sourceId: 'disabled',
          realtime: {
            feeds: [
              { feedId: 'alerts', url: 'https://example.test/alerts.pb' },
            ],
          },
        },
      ],
    });
    try {
      await assert.rejects(
        async () => gtfs.realtime.refresh(),
        (error: unknown) =>
          (
            error as {
              code?: unknown;
            }
          ).code === GtfsErrorCode.EXTENSION_DISABLED,
      );
      assert.equal(fetched, false);
    } finally {
      globalThis.fetch = originalFetch;
      await gtfs.close();
    }
  });
  test('matches standalone wrapper results and reporting events', async () => {
    const instanceSqlite = new Database(':memory:');
    const wrapperSqlite = new Database(':memory:');
    const instanceEvents: GtfsReportEvent[] = [];
    const wrapperEvents: GtfsReportEvent[] = [];
    const sources = [
      {
        sourceId: 'caltrain',
        schedule: { path: fixturePath },
      },
    ];
    const gtfs = new Gtfs({
      database: { client: instanceSqlite },
      sources,
      reporting: { reporter: (event) => instanceEvents.push(event) },
    });
    try {
      const instanceResult = await gtfs.import();
      const wrapperResult = await importGtfs({
        database: { client: wrapperSqlite },
        sources,
        reporting: { reporter: (event) => wrapperEvents.push(event) },
      });
      for (const result of [instanceResult, wrapperResult]) {
        assert.ok(Number.isFinite(result.durationMs) && result.durationMs >= 0);
        for (const source of result.sources) {
          assert.ok(
            Number.isFinite(source.durationMs) && source.durationMs >= 0,
          );
        }
      }
      const withoutDurations = (result: typeof instanceResult) => ({
        ...result,
        durationMs: 0,
        sources: result.sources.map((source) => ({ ...source, durationMs: 0 })),
      });
      assert.deepEqual(
        withoutDurations(instanceResult),
        withoutDurations(wrapperResult),
      );
      const eventSignatures = (events: readonly GtfsReportEvent[]) =>
        events
          .filter((event) => event.type !== 'progress')
          .map((event) => ({
            type: event.type,
            level: event.level,
            message:
              event.type === 'operation:complete'
                ? event.message.replace(/\d+\.\d seconds(?=;|$)/u, '<duration>')
                : event.message,
            operation: 'operation' in event ? event.operation : undefined,
          }));
      assert.deepEqual(
        eventSignatures(instanceEvents),
        eventSignatures(wrapperEvents),
      );
    } finally {
      await gtfs.close();
      instanceSqlite.close();
      wrapperSqlite.close();
    }
  });
  for (const closeMethod of ['close', 'asyncDispose'] as const) {
    test(
      `rejects operations across namespaces after ${closeMethod} begins and completes`,
      { timeout: 5000 },
      async (t) => {
        const statements: unknown[] = [];
        const events: GtfsReportEvent[] = [];
        const sqlite = new Database(':memory:', {
          verbose: (statement) => statements.push(statement),
        });
        const gtfs = new Gtfs({
          database: { client: sqlite },
          extensions: fixtureExtensions,
          reporting: { reporter: (event) => events.push(event) },
        });
        const gate = createGate();
        const started = createGate();
        const pending = gtfs.database.withKysely({
          callback: async () => {
            started.release();
            await gate.promise;
            return 'pending operation finished';
          },
        });
        try {
          await started.promise;
          const closing =
            closeMethod === 'close'
              ? gtfs.close()
              : gtfs[Symbol.asyncDispose]();
          let disposed = false;
          const disposing = gtfs[Symbol.asyncDispose]().then(() => {
            disposed = true;
          });
          const initialStatements = statements.slice();
          const initialEvents = events.slice();
          const assertClosed = (error: unknown) => {
            assert.ok(isGtfsError(error));
            assert.equal(error.code, GtfsErrorCode.INSTANCE_CLOSED);
            assert.equal(error.message, 'Gtfs instance is closing or closed');
            return true;
          };
          const operations: [string, () => PromiseLike<unknown>][] = [
            ['import', () => gtfs.import()],
            ['export', () => gtfs.export()],
            ['realtime.refresh', () => gtfs.realtime.refresh()],
            ['realtime.cleanup', () => gtfs.realtime.cleanup()],
            ['schema.ensure', () => gtfs.schema.ensure()],
            ['schema.validate', () => gtfs.schema.validate()],
            ['schema.recreate', () => gtfs.schema.recreate()],
            ['geojson.stops', () => gtfs.geojson.stops()],
            ['geojson.shapes', () => gtfs.geojson.shapes()],
            ['geojson.routes', () => gtfs.geojson.routes()],
            [
              'database.withKysely',
              () =>
                gtfs.database.withKysely({
                  callback: () =>
                    assert.fail('Closed instance must not invoke callbacks'),
                }),
            ],
          ];
          const repositories: readonly [string, TestRepository][] = [
            ['schedule.routes', gtfs.schedule.routes],
            ['realtime.alerts', gtfs.realtime.alerts],
            [
              'realtime.persistence.snapshots',
              gtfs.realtime.persistence.snapshots,
            ],
            ['gtfsPlus.directions', gtfs.gtfsPlus.directions],
            ['gtfsRide.rideFeedInfo', gtfs.gtfsRide.rideFeedInfo],
            ['gtfsToHtml.timetables', gtfs.gtfsToHtml.timetables],
            ['tods.runEvents', gtfs.tods.runEvents],
            ['tides.vehicles', gtfs.tides.vehicles],
          ];
          for (const [name, repository] of repositories) {
            operations.push([`${name}.all`, () => repository.all()]);
            if (name !== 'schedule.routes' && name !== 'realtime.alerts') {
              continue;
            }
            operations.push(
              [`${name}.first`, () => repository.first()],
              [`${name}.count`, () => repository.count()],
            );
          }
          for (const phase of ['closing', 'closed'] as const) {
            assert.equal(gtfs.isClosed, phase === 'closed');
            for (const [name, operation] of operations) {
              await t.test(`${phase}: ${name}`, async () => {
                await assert.rejects(
                  async () =>
                    typeof operation === 'function' ? operation() : operation,
                  assertClosed,
                );
              });
            }
            for (const level of ['info', 'warn', 'error'] as const) {
              assert.throws(
                () =>
                  gtfs.reporting.log({
                    level,
                    message: 'Must not be reported',
                  }),
                assertClosed,
              );
            }
            assert.deepEqual(statements, initialStatements);
            assert.deepEqual(events, initialEvents);
            if (phase === 'closing') {
              assert.equal(disposed, false);
              gate.release();
              assert.equal(await pending, 'pending operation finished');
              await Promise.all([closing, disposing]);
              assert.equal(disposed, true);
            }
          }
          await gtfs[Symbol.asyncDispose]();
          await gtfs.close();
          assert.equal(gtfs.isClosed, true);
          assert.equal(sqlite.open, true);
        } finally {
          gate.release();
          await gtfs.close();
          sqlite.close();
        }
      },
    );
  }
  for (const failureMode of [
    'synchronous throw',
    'asynchronous rejection',
  ] as const) {
    test(
      `continues queued operations after ${failureMode}`,
      { timeout: 5000 },
      async () => {
        const gtfs = new Gtfs({ database: {} });
        const gate = createGate();
        const started = createGate();
        const events: string[] = [];
        const failure = new Error('Intentional queued operation failure');
        const blocker = gtfs.database.withKysely({
          callback: async () => {
            events.push('blocker:start');
            started.release();
            await gate.promise;
            events.push('blocker:end');
          },
        });
        try {
          await started.promise;
          const failed = gtfs.database.withKysely({
            callback: () => {
              events.push('failure');
              if (failureMode === 'synchronous throw') {
                throw failure;
              }
              return Promise.reject(failure);
            },
          });
          const rejected = assert.rejects(
            async () => failed,
            (error: unknown) => error === failure,
          );
          const schema = gtfs.schema.ensure();
          const insert = gtfs.database.withKysely({
            callback: async (database) => {
              await sql`insert into routes (source_id, route_id, route_type)
              values ('test', 'recovered', 3)`.execute(database);
              events.push('insert');
              return 'inserted';
            },
          });
          const rows = gtfs.schedule.routes.select('route_id').all();
          const validation = gtfs.schema.validate();
          assert.deepEqual(events, ['blocker:start']);
          gate.release();
          const [, , inspection, inserted, result, validated] =
            await Promise.all([
              blocker,
              rejected,
              schema,
              insert,
              rows,
              validation,
            ]);
          assert.equal(inspection.compatible, true);
          assert.equal(inserted, 'inserted');
          assert.deepEqual(result, [{ route_id: 'recovered' }]);
          assert.equal(validated.compatible, true);
          assert.deepEqual(events, [
            'blocker:start',
            'blocker:end',
            'failure',
            'insert',
          ]);
          assert.equal(gtfs.isClosed, false);
          assert.equal(await gtfs.schedule.routes.count(), 1);
        } finally {
          gate.release();
          await gtfs[Symbol.asyncDispose]();
        }
        assert.equal(gtfs.isClosed, true);
      },
    );
  }
});
