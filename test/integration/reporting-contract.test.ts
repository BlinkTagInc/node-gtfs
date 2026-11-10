import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import {
  Gtfs,
  createConsoleReporter,
  exportGtfs,
  importGtfs,
  type GtfsReportEvent,
} from '../../src/index.ts';
import { cleanupGtfsRealtime } from '../../src/kysely.ts';
import { describe, it } from 'node:test';

import { stripColors } from '../helpers/console-output.ts';

const validationFixture = 'test/fixtures/v4-baseline/missing-required-files';

function assertEventEnvelope(event: GtfsReportEvent): void {
  assert.equal(typeof event.type, 'string');
  assert.match(event.level, /^(error|warn|info)$/u);
  assert.equal(Number.isSafeInteger(event.timestampMs), true);
  assert.equal(event.timestampMs > 0, true);
  assert.match(event.operationId, /^[0-9a-f-]{36}$/u);
  assert.equal(typeof event.message, 'string');
  assert.equal(Object.isFrozen(event), true);
}

describe('structured reporting contract', () => {
  for (const [level, expectedLevels] of [
    ['silent', []],
    ['error', ['error']],
    ['warn', ['warn', 'error']],
    ['info', ['info', 'warn', 'error']],
  ] as const) {
    it(`filters reporting at the ${level} level`, async () => {
      const events: GtfsReportEvent[] = [];
      const gtfs = new Gtfs({
        database: {},
        reporting: {
          level,
          reporter: (event) => events.push(event),
        },
      });
      try {
        for (const messageLevel of ['info', 'warn', 'error'] as const) {
          gtfs.reporting.log({
            level: messageLevel,
            message: `${messageLevel} message`,
          });
        }
        assert.deepEqual(
          events.map((event) => [event.level, event.message]),
          expectedLevels.map((eventLevel) => [
            eventLevel,
            `${eventLevel} message`,
          ]),
        );
        const beforeSchema = events.length;
        await gtfs.schema.validate();
        assert.deepEqual(
          events.slice(beforeSchema).map((event) => event.type),
          level === 'info' ? ['operation:start', 'operation:complete'] : [],
        );
      } finally {
        await gtfs.close();
      }
    });
  }
  it('assigns a new operation ID to each operation on one instance', async () => {
    const db = new Database(':memory:');
    const events: GtfsReportEvent[] = [];
    const gtfs = new Gtfs({
      database: { client: db },
      reporting: { reporter: (event) => events.push(event) },
    });

    try {
      await gtfs.schema.validate();
      await gtfs.schema.validate();

      const starts = events.filter((event) => event.type === 'operation:start');
      assert.equal(starts.length, 2);
      assert.notEqual(starts[0]?.operationId, starts[1]?.operationId);
      for (const operationId of starts.map((event) => event.operationId)) {
        assert.equal(
          events.filter((event) => event.operationId === operationId).length,
          2,
        );
      }
    } finally {
      await gtfs.close();
      if (db.open) {
        db.close();
      }
    }
  });

  it('orders immutable import and validation events with one operation ID', async () => {
    const db = new Database(':memory:');
    const events: GtfsReportEvent[] = [];
    try {
      await importGtfs({
        database: { client: db },
        sources: [
          {
            sourceId: 'reporting',
            schedule: {
              path: validationFixture,
              import: {
                validation: {
                  mode: 'permissive',
                  onUnknownField: 'discard',
                },
              },
            },
          },
        ],
        extensions: ['gtfs-realtime'],
        reporting: { reporter: (event) => events.push(event) },
      });

      assert.equal(events[0]?.type, 'operation:start');
      assert.equal(
        events[0]?.type === 'operation:start' ? events[0].sourceCount : 0,
        1,
      );
      assert.equal(
        events.some((event) => event.type === 'schema:recreate'),
        false,
      );
      assert.equal(events.at(-1)?.type, 'operation:complete');
      const completion = events.at(-1);
      assert.equal(
        completion?.type === 'operation:complete' &&
          Number.isSafeInteger(completion.durationMs) &&
          completion.durationMs >= 0,
        true,
      );
      assert.equal(
        events.some((event) => event.type === 'validation:notice'),
        true,
      );
      assert.equal(new Set(events.map((event) => event.operationId)).size, 1);
      for (const event of events) {
        assertEventEnvelope(event);
      }

      const notice = events.find(
        (
          event,
        ): event is Extract<GtfsReportEvent, { type: 'validation:notice' }> =>
          event.type === 'validation:notice',
      );
      assert.equal(notice?.sourceId, 'reporting');
      assert.equal(typeof notice?.filename, 'string');
      assert.equal(Object.isFrozen(notice?.notice), true);
    } finally {
      db.close();
    }
  });

  it('uses the same envelope for export, schema validation, and cleanup', async () => {
    const db = new Database(':memory:');
    const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-reporting-'));
    const exportEvents: GtfsReportEvent[] = [];
    const validationEvents: GtfsReportEvent[] = [];
    const cleanupEvents: GtfsReportEvent[] = [];

    try {
      await importGtfs({
        database: { client: db },
        sources: [
          {
            sourceId: 'reporting',
            schedule: {
              path: validationFixture,
              import: {
                validation: {
                  mode: 'permissive',
                  onUnknownField: 'discard',
                },
              },
            },
          },
        ],
        extensions: ['gtfs-realtime'],
      });
      await exportGtfs({
        database: { client: db },
        export: {
          sourceId: 'reporting',
          outputDirectory: path.join(directory, 'export'),
        },
        reporting: { reporter: (event) => exportEvents.push(event) },
      });

      const gtfs = new Gtfs({
        database: { client: db },
        reporting: {
          reporter: (event) => validationEvents.push(event),
        },
      });
      await gtfs.schema.validate();
      await gtfs.close();

      const kysely = new Kysely({
        dialect: new SqliteDialect({ database: db }),
      });
      await assert.rejects(
        cleanupGtfsRealtime({
          database: kysely,
          extensions: ['gtfs-realtime'],
          // @ts-expect-error Standalone reporting must be nested.
          reporter: (event: GtfsReportEvent) => cleanupEvents.push(event),
        }),
        /Unknown `cleanupGtfsRealtime\(\)` option "reporter"/u,
      );
      await cleanupGtfsRealtime({
        database: kysely,
        nowUnixSeconds: 0,
        extensions: ['gtfs-realtime'],
        reporting: { reporter: (event) => cleanupEvents.push(event) },
      });

      for (const [operation, events] of [
        ['export', exportEvents],
        ['validation', validationEvents],
        ['cleanup', cleanupEvents],
      ] as const) {
        assert.equal(events[0]?.type, 'operation:start');
        assert.equal(
          events[0]?.type === 'operation:start'
            ? events[0].operation
            : undefined,
          operation,
        );
        assert.equal(events.at(-1)?.type, 'operation:complete');
        const completion = events.at(-1);
        assert.equal(
          completion?.type === 'operation:complete' &&
            Number.isSafeInteger(completion.durationMs) &&
            completion.durationMs >= 0,
          true,
        );
        for (const event of events) {
          assertEventEnvelope(event);
        }
      }
    } finally {
      if (db.open) {
        db.close();
      }
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('keeps library defaults silent so stdout remains machine-readable', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-silent-library-'));
    const databasePath = path.join(directory, 'gtfs.sqlite');
    try {
      const script = [
        "import { importGtfs } from './src/index.ts';",
        'const [feedPath, databasePath] = process.argv.slice(1);',
        "await importGtfs({ database: { path: databasePath }, sources: [{ sourceId: 'silent', schedule: { path: feedPath, import: { validation: { mode: 'permissive', onUnknownField: 'discard' } } } }] });",
        'process.stdout.write(JSON.stringify({ ok: true }));',
      ].join('\n');
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          script,
          validationFixture,
          databasePath,
        ],
        { cwd: process.cwd(), encoding: 'utf8' },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), { ok: true });
      assert.equal(result.stderr, '');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('writes newline-delimited console diagnostics to its configured stream', async () => {
    const stream = new PassThrough();
    let output = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk: string) => {
      output += chunk;
    });
    const reporter = createConsoleReporter({
      stream,
      animateProgress: false,
    });
    const gtfs = new Gtfs({
      database: {},
      reporting: {
        reporter,
      },
    });
    try {
      gtfs.reporting.log({ level: 'info', message: 'information' });
      gtfs.reporting.log({ level: 'warn', message: 'warning' });
      reporter({
        type: 'status',
        level: 'info',
        timestampMs: Date.now(),
        operationId: 'test-operation',
        message: 'routes.txt',
        phase: 'complete',
      });
      assert.match(stripColors(output), /==> information\n/u);
      assert.match(stripColors(output), /Warning: warning\n/u);
      assert.match(stripColors(output), /✔\s+routes\.txt\n/u);
    } finally {
      await gtfs.close();
      stream.end();
    }
  });

  for (const ending of ['complete', 'warn', 'error'] as const) {
    it(`advances the spinner and stops after ${ending}`, (t) => {
      t.mock.timers.enable({ apis: ['setInterval'] });
      const stream = new PassThrough();
      let output = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk: string) => {
        output += chunk;
      });
      const reporter = createConsoleReporter({
        stream,
        animateProgress: true,
      });
      const envelope = {
        level: 'info',
        timestampMs: Date.now(),
        operationId: 'test-operation',
      } as const;

      reporter({
        ...envelope,
        type: 'status',
        message: 'Importing routes.txt',
        phase: 'start',
      });
      const initial = output;
      t.mock.timers.tick(80);
      assert.notEqual(output, initial);
      assert.match(stripColors(output), /⠙\s+Importing routes\.txt/u);
      t.mock.timers.tick(80);
      assert.match(stripColors(output), /⠹\s+Importing routes\.txt/u);
      reporter(
        ending === 'complete'
          ? {
              ...envelope,
              type: 'status',
              message: 'routes.txt',
              phase: 'complete',
            }
          : { ...envelope, type: 'message', level: ending, message: 'Stopped' },
      );
      const finished = output;
      t.mock.timers.tick(1000);
      assert.equal(output, finished);
      stream.end();

      assert.match(stripColors(output), /⠋\s+Importing routes\.txt/u);
      assert.match(
        stripColors(output),
        ending === 'complete' ? /✔\s+routes\.txt\n/u : /Stopped\n/u,
      );
    });
  }

  it('rejects unknown console animation options', () => {
    assert.throws(
      () =>
        createConsoleReporter({
          // @ts-expect-error `animate` is not a supported option.
          animate: false,
        }),
      /Unknown `createConsoleReporter\(\)` option "animate"/u,
    );
  });
});
