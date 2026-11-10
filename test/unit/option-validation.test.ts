import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Gtfs } from '../../src/instance.ts';
import {
  resolveGtfsConfig,
  resolveGtfsImportConfig,
} from '../../src/config/resolver.ts';
import { formatConfigPath } from '../../src/config/validation.ts';
import { resolveGtfsExtensions } from '../../src/schema/extensions.ts';
import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../../src/diagnostics/errors.ts';
import {
  isNonNegativeNumber,
  isPlainObject,
} from '../../src/config/options.ts';
import { resolveGtfsRealtimeCleanupOptions } from '../../src/realtime/cleanup-options.ts';
import { assertReportingConfig } from '../../src/reporting/options.ts';
function captureConfigError(callback: () => unknown): GtfsError {
  try {
    callback();
  } catch (error: unknown) {
    assert.ok(error instanceof GtfsError);
    assert.equal(error.code, GtfsErrorCode.CONFIG_INVALID);
    assert.equal(error.category, GtfsErrorCategory.CONFIG);
    return error;
  }
  assert.fail('Expected GTFS_CONFIG_INVALID');
}
describe('shared runtime option validation', () => {
  test('recognizes plain and null-prototype objects, but not other containers', () => {
    for (const value of [{}, Object.create(null)]) {
      assert.equal(isPlainObject(value), true);
    }
    for (const value of [
      undefined,
      null,
      [],
      new Date(),
      new Map(),
      Object.create({ inherited: true }),
      'object',
      1,
      () => undefined,
    ]) {
      assert.equal(isPlainObject(value), false);
    }
    assert.equal(formatConfigPath('', 'sources'), 'sources');
    assert.equal(
      formatConfigPath('sources[0].schedule', 'timeoutMs'),
      'sources[0].schedule.timeoutMs',
    );
  });
  test('distinguishes non-negative numbers from positive safe integers', () => {
    assert.equal(isNonNegativeNumber(0), true);
    assert.equal(isNonNegativeNumber(0.5), true);
    assert.equal(isNonNegativeNumber(0, { positive: true }), false);
    assert.equal(isNonNegativeNumber(0.5, { integer: true }), false);
    assert.equal(
      isNonNegativeNumber(Number.MAX_SAFE_INTEGER, { integer: true }),
      true,
    );
    for (const value of [-1, NaN, Infinity, '1', true, null, undefined, 1n]) {
      assert.equal(isNonNegativeNumber(value), false);
    }
    assert.equal(
      isNonNegativeNumber(Number.MAX_SAFE_INTEGER + 1, { integer: true }),
      false,
    );
  });
  test('rejects undefined and sparse extension entries through both entry points', () => {
    for (const extensions of [
      [undefined],
      Array(1),
      ['gtfs-plus', undefined],
      ['unknown'],
      ['gtfs-schedule'],
      ['tides', 'tides'],
      ['tods', 'tods-v1'],
      null,
      'all',
    ]) {
      const direct = captureConfigError(() =>
        resolveGtfsExtensions(extensions as never),
      );
      const configured = captureConfigError(() =>
        resolveGtfsConfig({ database: {}, extensions }),
      );
      const issues = configured.details?.errors;
      assert.ok(issues);
      assert.equal(direct.message, issues[0]?.message);
      assert.equal(direct.details?.path, issues[0]?.path);
    }
  });
  test('copies, freezes, and canonically orders valid selections and retains import-only auto', () => {
    const selection = ['tides', 'gtfs-plus'] as const;
    const direct = resolveGtfsExtensions(selection);
    const configured = resolveGtfsConfig({
      database: {},
      extensions: selection,
    });
    assert.deepEqual(direct, ['gtfs-plus', 'tides']);
    assert.deepEqual(configured.extensions, direct);
    assert.notEqual(direct, selection);
    assert.equal(Object.isFrozen(direct), true);
    assert.equal(Object.isFrozen(configured.extensions), true);
    assert.deepEqual(resolveGtfsExtensions(undefined), []);
    assert.deepEqual(resolveGtfsConfig({ database: {} }).extensions, []);
    assert.equal(
      resolveGtfsImportConfig({
        database: { path: ':memory:' },
        extensions: 'auto',
        sources: [{ schedule: { path: 'unused' } }],
      }).extensions,
      'auto',
    );
    captureConfigError(() => resolveGtfsExtensions('auto' as never));
    captureConfigError(() =>
      resolveGtfsConfig({
        database: {},
        extensions: 'auto',
      }),
    );
  });
  test('accumulates extension, numeric, and reporting issues without applying invalid values', () => {
    const error = captureConfigError(() =>
      resolveGtfsConfig({
        database: {},
        extensions: ['unknown', undefined, 'tides', 'tides', 'tods', 'tods-v1'],
        export: { batchSize: Number.MAX_SAFE_INTEGER + 1 },
        reporting: { reporter: 3, level: 'debug' },
      }),
    );
    const issues = error.details?.errors;
    assert.ok(issues);
    assert.deepEqual(
      issues.map(({ path }) => path).sort(),
      [
        'extensions[0]',
        'extensions[1]',
        'extensions[3]',
        'extensions',
        'export.batchSize',
        'reporting.reporter',
        'reporting.level',
      ].sort(),
    );
  });
  test('uses identical reporting validation for configuration and standalone cleanup', (t) => {
    const database = new Kysely({
      dialect: new SqliteDialect({ database: new Database(':memory:') }),
    });
    t.after(() => database.destroy());
    for (const reporting of [
      null,
      [],
      new Date(),
      { level: 'debug' },
      { reporter: false },
      { level: 'warning' },
      { verbose: true },
      { logLevel: 'info' },
      { logFunction: () => undefined },
      { levl: 'info' },
    ]) {
      const configured = captureConfigError(() =>
        resolveGtfsConfig({ database: {}, reporting }),
      );
      const standalone = captureConfigError(() =>
        assertReportingConfig(reporting as never),
      );
      const cleanup = captureConfigError(() =>
        resolveGtfsRealtimeCleanupOptions({
          database,
          extensions: ['gtfs-realtime'],
          reporting,
        } as never),
      );
      assert.deepEqual(standalone.details?.errors, configured.details?.errors);
      assert.deepEqual(cleanup.details?.errors, configured.details?.errors);
    }
  });
  test('retains reporting defaults, callback identity, and JSON-only restrictions', () => {
    const reporter = () => undefined;
    for (const level of ['silent', 'error', 'warn', 'info'] as const) {
      assert.doesNotThrow(() => assertReportingConfig({ level, reporter }));
      assert.equal(
        resolveGtfsConfig({
          database: {},
          reporting: { level, reporter },
        }).reporting.level,
        level,
      );
    }
    assert.equal(resolveGtfsConfig({ database: {} }).reporting.level, 'silent');
    const reporting = resolveGtfsConfig({
      database: {},
      reporting: { reporter },
    }).reporting;
    assert.equal(reporting.level, 'info');
    assert.equal(reporting.reporter, reporter);
    assert.equal(Object.isFrozen(reporting), true);
    captureConfigError(() =>
      resolveGtfsConfig(
        { database: {}, reporting: { reporter } },
        { format: 'json' },
      ),
    );
  });
  test('rejects invalid export batch sizes in config and per-call options before schema access', async () => {
    const gtfs = new Gtfs({ database: {} });
    try {
      for (const batchSize of [
        0,
        -1,
        0.5,
        Number.MAX_SAFE_INTEGER + 1,
        Infinity,
        NaN,
        '1',
        null,
      ]) {
        captureConfigError(() =>
          resolveGtfsConfig({
            database: {},
            export: { batchSize },
          }),
        );
        await assert.rejects(async () => gtfs.export({ batchSize } as never), {
          code: GtfsErrorCode.CONFIG_INVALID,
        });
      }
      assert.equal(
        resolveGtfsConfig({
          database: {},
          export: { batchSize: Number.MAX_SAFE_INTEGER },
        }).export.batchSize,
        Number.MAX_SAFE_INTEGER,
      );
    } finally {
      await gtfs.close();
    }
  });
  test('keeps repository option failures query-specific', async () => {
    const gtfs = new Gtfs({ database: {} });
    try {
      for (const options of [
        null,
        [],
        new Date(),
        { bogus: true },
        { where: new Date() },
      ]) {
        await assert.rejects(
          async () =>
            Reflect.apply(gtfs.schedule.routes.all, undefined, [options]),
          (error: unknown) => {
            assert.ok(error instanceof GtfsError);
            assert.equal(error.code, GtfsErrorCode.QUERY_INVALID);
            assert.equal(error.category, GtfsErrorCategory.QUERY);
            assert.equal(error.details?.table, 'routes');
            assert.equal(error.details?.method, 'all');
            return true;
          },
        );
      }
    } finally {
      await gtfs.close();
    }
  });
});
