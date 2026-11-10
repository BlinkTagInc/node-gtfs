import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import Database from 'better-sqlite3';

import {
  resolveGtfsConfig,
  resolveGtfsExportConfig,
  resolveGtfsImportConfig,
  resolveGtfsInstanceConfig,
} from '../../src/config/resolver.ts';
import { GtfsErrorCode } from '../../src/diagnostics/errors.ts';

function configError(callback: () => unknown) {
  try {
    callback();
  } catch (error: unknown) {
    assert.ok(error instanceof Error);
    assert.equal(
      (error as Error & { code?: string }).code,
      GtfsErrorCode.CONFIG_INVALID,
    );
    return error as Error & { details: Record<string, unknown> };
  }
  assert.fail('Expected GTFS_CONFIG_INVALID');
}

describe('final v5 configuration resolver', () => {
  test('accepts the three validation modes and rejects invalid values without a fallback', () => {
    const resolve = (mode: unknown) =>
      resolveGtfsImportConfig({
        database: { path: ':memory:' },
        sources: [
          {
            schedule: { path: './feed.zip', import: { validation: { mode } } },
          },
        ],
      });
    for (const mode of ['off', 'strict', 'permissive']) {
      assert.equal(
        resolve(mode).sources[0]?.schedule.import.validation.mode,
        mode,
      );
    }
    for (const mode of ['invalid-mode', null, true, 1, {}]) {
      const error = configError(() => resolve(mode));
      assert.deepEqual(error.details.errors, [
        {
          reason: 'invalid-value',
          path: 'sources[0].schedule.import.validation.mode',
          message:
            'Configuration option `sources[0].schedule.import.validation.mode` must be one of "off", "strict", "permissive"',
        },
      ]);
    }
  });

  test('rejects invalid onSourceError policies at the source import path', () => {
    for (const onSourceError of ['ignore', null, true, 1, {}]) {
      const error = configError(() =>
        resolveGtfsImportConfig({
          database: { path: ':memory:' },
          sources: [
            {
              schedule: { path: './feed.zip', import: { onSourceError } },
            },
          ],
        }),
      );
      assert.deepEqual(error.details.errors, [
        {
          reason: 'invalid-value',
          path: 'sources[0].schedule.import.onSourceError',
          message:
            'Configuration option `sources[0].schedule.import.onSourceError` must be one of "abort", "continue"',
        },
      ]);
    }
  });

  test('accepts unknown-field policies and rejects unsupported values', () => {
    const resolve = (onUnknownField: unknown) =>
      resolveGtfsImportConfig({
        database: { path: ':memory:' },
        sources: [
          {
            schedule: {
              path: './feed.zip',
              import: { validation: { onUnknownField } },
            },
          },
        ],
      });
    for (const onUnknownField of ['reject', 'preserve', 'discard']) {
      assert.equal(
        resolve(onUnknownField).sources[0]?.schedule.import.validation
          .onUnknownField,
        onUnknownField,
      );
    }
    for (const onUnknownField of ['ignore', null, true, 1, {}]) {
      const error = configError(() => resolve(onUnknownField));
      assert.deepEqual(error.details.errors, [
        {
          reason: 'invalid-value',
          path: 'sources[0].schedule.import.validation.onUnknownField',
          message:
            'Configuration option `sources[0].schedule.import.validation.onUnknownField` must be one of "reject", "preserve", "discard"',
        },
      ]);
    }
  });

  test('uses the default import action policies when none are configured', () => {
    const resolved = resolveGtfsImportConfig({
      database: { path: ':memory:' },
      sources: [{ schedule: { path: './feed.zip' } }],
    });
    const scheduleImport = resolved.sources[0]?.schedule.import;
    assert.ok(scheduleImport);
    assert.equal(scheduleImport.onExistingData, 'replace-source');
    assert.equal(scheduleImport.onSourceError, 'abort');
    assert.deepEqual(scheduleImport.validation, {
      mode: 'off',
      onUnknownField: 'preserve',
      onDuplicateKey: 'reject',
    });
  });

  test('resolves every documented option from its final path', () => {
    const reporter = () => undefined;
    const resolved = resolveGtfsConfig(
      {
        database: {
          path: './complete.sqlite',
          durability: 'unsafe-bulk',
        },
        reporting: { level: 'warn', reporter },
        extensions: ['gtfs-realtime', 'gtfs-ride'],
        sources: [
          {
            sourceId: 'complete',
            schedule: {
              url: 'https://example.com/gtfs.zip',
              requestHeaders: { Authorization: 'schedule-token' },
              timeoutMs: 12_345,
              excludeFiles: ['shapes.txt'],
              defaultAgencyId: 'default-agency',
              import: {
                onExistingData: 'reject',
                csv: { skipEmptyLines: false },
                onSourceError: 'continue',
                validation: {
                  mode: 'permissive',
                  onUnknownField: 'discard',
                  onDuplicateKey: 'keep-first',
                },
              },
            },
            realtime: {
              feeds: [
                {
                  feedId: 'vehicle-and-alerts',
                  type: 'mixed',
                  url: 'https://example.com/realtime.pb',
                  requestHeaders: { Authorization: 'realtime-token' },
                  timeoutMs: 6_789,
                },
              ],
            },
          },
        ],
        realtime: {
          retention: {
            currentEntitiesSeconds: 300,
            snapshotsSeconds: 86_400,
          },
        },
        export: {
          outputDirectory: './exported',
          sourceId: 'complete',
          batchSize: 250,
        },
      },
      { operation: 'import' },
    );

    assert.deepEqual(resolved.database, {
      dialect: 'sqlite',
      path: './complete.sqlite',
      durability: 'unsafe-bulk',
    });
    assert.equal(resolved.reporting.level, 'warn');
    assert.equal(resolved.reporting.reporter, reporter);
    assert.deepEqual(resolved.extensions, ['gtfs-realtime', 'gtfs-ride']);
    assert.deepEqual(resolved.sources[0]!.schedule, {
      url: 'https://example.com/gtfs.zip',
      requestHeaders: { Authorization: 'schedule-token' },
      timeoutMs: 12_345,
      excludeFiles: ['shapes.txt'],
      defaultAgencyId: 'default-agency',
      import: {
        archive: {
          maxCompressedBytes: 1073741824,
          maxEntries: 1000,
          maxExtractedFileBytes: 4294967296,
          maxExtractedTotalBytes: 8589934592,
        },
        onExistingData: 'reject',
        csv: {
          encoding: 'utf8',
          delimiter: ',',
          quote: '"',
          escape: '"',
          trim: true,
          relaxQuotes: true,
          skipEmptyLines: false,
        },
        onSourceError: 'continue',
        validation: {
          mode: 'permissive',
          onUnknownField: 'discard',
          onDuplicateKey: 'keep-first',
        },
      },
    });
    assert.deepEqual(resolved.sources[0]!.realtime, {
      feeds: [
        {
          feedId: 'vehicle-and-alerts',
          type: 'mixed',
          url: 'https://example.com/realtime.pb',
          requestHeaders: { Authorization: 'realtime-token' },
          timeoutMs: 6_789,
          maxDownloadBytes: 67108864,
        },
      ],
    });
    assert.deepEqual(resolved.realtime, {
      retention: {
        currentEntitiesSeconds: 300,
        snapshotsSeconds: 86_400,
      },
    });
    assert.deepEqual(resolved.export, {
      outputDirectory: './exported',
      overwrite: false,
      sourceId: 'complete',
      batchSize: 250,
    });
  });

  test('resolves source-local defaults without retaining config containers', () => {
    const input = {
      database: { path: './gtfs.sqlite' },
      extensions: ['gtfs-realtime', 'tides'],
      reporting: { level: 'info' },
      sources: [
        {
          schedule: {
            url: 'https://example.com/gtfs.zip',
            requestHeaders: { Authorization: 'token' },
            excludeFiles: ['shapes.txt'],
            import: {
              csv: { trim: true },
              validation: { onDuplicateKey: 'keep-first' },
            },
          },
          realtime: {
            feeds: [
              {
                feedId: 'main',
                url: 'https://example.com/realtime.pb',
              },
            ],
          },
        },
      ],
    };

    const resolved = resolveGtfsConfig(input, { operation: 'import' });
    assert.deepEqual(resolved.extensions, ['gtfs-realtime', 'tides']);
    assert.equal(resolved.sources[0]!.sourceId, 'default');
    const schedule = resolved.sources[0]!.schedule!;
    assert.ok('url' in schedule);
    assert.equal(schedule.timeoutMs, 120_000);
    assert.equal(schedule.import.onExistingData, 'replace-source');
    assert.equal(schedule.import.onSourceError, 'abort');
    assert.deepEqual(schedule.import.validation, {
      mode: 'off',
      onUnknownField: 'preserve',
      onDuplicateKey: 'keep-first',
    });
    assert.equal(resolved.realtime.retention.snapshotsSeconds, 86_400);
    assert.equal(resolved.export.batchSize, 1_000);
    assert.equal(resolved.export.overwrite, false);

    assert.notEqual(resolved.sources, input.sources);
    assert.notEqual(
      schedule.requestHeaders,
      input.sources[0]!.schedule.requestHeaders,
    );
    assert.ok(Object.isFrozen(resolved));
    assert.ok(Object.isFrozen(resolved.sources));
    assert.ok(Object.isFrozen(resolved.sources[0]));
    assert.ok(Object.isFrozen(resolved.sources[0]!.schedule));
    assert.ok(Object.isFrozen(resolved.sources[0]!.schedule!.import.csv));

    input.sources[0]!.schedule.requestHeaders.Authorization = 'changed';
    input.sources[0]!.schedule.excludeFiles.push('routes.txt');
    assert.deepEqual(schedule.requestHeaders, {
      Authorization: 'token',
    });
    assert.deepEqual(resolved.sources[0]!.schedule!.excludeFiles, [
      'shapes.txt',
    ]);
  });

  test('requires explicit source IDs when configuring multiple sources', () => {
    const error = configError(() =>
      resolveGtfsConfig({
        database: {},
        sources: [
          { schedule: { path: './first.zip' } },
          { sourceId: 'second', schedule: { path: './second.zip' } },
        ],
      }),
    );

    assert.match(
      error.message,
      /`sources\[0\]\.sourceId` is required when configuring multiple sources/,
    );
  });

  test('accepts Realtime-only sources and endpoint-local settings', () => {
    const resolved = resolveGtfsConfig(
      {
        database: {},
        extensions: ['gtfs-realtime'],
        sources: [
          {
            sourceId: 'metro',
            realtime: {
              feeds: [
                {
                  type: 'mixed',
                  url: 'https://example.com/realtime.pb',
                  requestHeaders: { Authorization: 'token' },
                  timeoutMs: 5_000,
                },
              ],
            },
          },
        ],
      },
      { operation: 'realtime' },
    );

    assert.equal(resolved.sources[0]!.schedule, undefined);
    assert.equal(resolved.sources[0]!.realtime!.feeds[0]!.feedId, 'mixed');
    assert.equal(resolved.sources[0]!.realtime!.feeds[0]!.type, 'mixed');
    assert.equal(resolved.sources[0]!.realtime!.feeds[0]!.timeoutMs, 5_000);
  });

  test('derives feed identities from type and permits explicit same-type identities', () => {
    const resolved = resolveGtfsConfig(
      {
        database: {},
        extensions: ['gtfs-realtime'],
        sources: [
          {
            sourceId: 'metro',
            realtime: {
              feeds: [
                { type: 'alerts', url: 'https://example.com/alerts.pb' },
                {
                  type: 'alerts',
                  feedId: 'rail-alerts',
                  url: 'https://example.com/rail-alerts.pb',
                },
                {
                  feedId: 'unclassified',
                  url: 'https://example.com/mixed.pb',
                },
              ],
            },
          },
        ],
      },
      { operation: 'realtime' },
    );

    assert.deepEqual(resolved.sources[0]!.realtime!.feeds, [
      {
        feedId: 'alerts',
        type: 'alerts',
        url: 'https://example.com/alerts.pb',
        requestHeaders: {},
        timeoutMs: 30_000,
        maxDownloadBytes: 67108864,
      },
      {
        feedId: 'rail-alerts',
        type: 'alerts',
        url: 'https://example.com/rail-alerts.pb',
        requestHeaders: {},
        timeoutMs: 30_000,
        maxDownloadBytes: 67108864,
      },
      {
        feedId: 'unclassified',
        url: 'https://example.com/mixed.pb',
        requestHeaders: {},
        timeoutMs: 30_000,
        maxDownloadBytes: 67108864,
      },
    ]);
  });

  test('rejects missing and duplicate resolved Realtime feed identities', () => {
    const error = configError(() =>
      resolveGtfsConfig(
        {
          database: {},
          extensions: ['gtfs-realtime'],
          sources: [
            {
              sourceId: 'metro',
              realtime: {
                feeds: [
                  { type: 'alerts', url: 'https://example.com/one.pb' },
                  { type: 'alerts', url: 'https://example.com/two.pb' },
                  { url: 'https://example.com/unidentified.pb' },
                ],
              },
            },
          ],
        } as never,
        { operation: 'realtime' },
      ),
    );

    assert.match(error.message, /Duplicate resolved Realtime feed ID "alerts"/);
    assert.match(error.message, /requires `type` or `feedId`/);
  });

  test('aggregates malformed nesting, duplicate identities, and invalid policies', () => {
    const error = configError(() =>
      resolveGtfsConfig(
        {
          database: { path: 'a', client: {} },
          extensions: ['gtfs-realtime', 'gtfs-realtime', 'unknown'],
          sources: [
            {
              sourceId: 'same',
              schedule: {
                url: 'https://example.com/a.zip',
                path: './a.zip',
                requestHeaders: { Authorization: 1 },
                timeoutMs: -1,
                excludeFiles: ['shapes'],
                import: {
                  onExistingData: 'merge',
                  validation: {
                    mode: 'loose',
                    onDuplicateKey: 'skip',
                  },
                },
              },
              realtime: {
                feeds: [
                  { feedId: 'same', url: 'https://example.com/one.pb' },
                  { feedId: 'same', url: 'https://example.com/two.pb' },
                ],
              },
            },
            {
              sourceId: 'same',
              schedule: { path: './b.zip', timeoutMs: 10 },
            },
          ],
          realtime: {
            retention: { currentEntitiesSeconds: -1, snapshotsSeconds: -2 },
          },
          export: { batchSize: 0, overwrite: 'yes' },
        },
        { operation: 'import' },
      ),
    );
    for (const path of [
      'database',
      'extensions',
      'sources[0].schedule',
      'sources[0].schedule.requestHeaders.Authorization',
      'sources[0].schedule.timeoutMs',
      'sources[0].schedule.excludeFiles[0]',
      'sources[0].schedule.import.onExistingData',
      'sources[0].realtime.feeds[1].feedId',
      'sources[1].sourceId',
      'realtime.retention.currentEntitiesSeconds',
      'export.batchSize',
      'export.overwrite',
    ]) {
      assert.match(error.message, new RegExp(path.replaceAll('[', '\\[')));
    }
  });

  test('reports complete nested typo paths and rejects unrecognized options', () => {
    const typo = configError(() =>
      resolveGtfsConfig({
        database: {},
        sources: [
          {
            sourceId: 'metro',
            schedule: {
              path: './gtfs.zip',
              exludeFiles: ['shapes.txt'],
            },
          },
        ],
      }),
    );
    assert.match(typo.message, /sources\[0\]\.schedule\.excludeFiles/);

    const unknown = configError(() =>
      resolveGtfsConfig({
        database: {},
        sources: [
          {
            schedule: { path: './gtfs.zip' },
            applicationMetadata: { owner: 'example' },
          },
        ],
        applicationMetadata: { environment: 'test' },
      }),
    );
    assert.match(
      unknown.message,
      /Unknown configuration option `applicationMetadata`/,
    );
    assert.match(
      unknown.message,
      /Unknown configuration option `sources\[0\].applicationMetadata`/,
    );
  });

  test('enforces JSON-only values and JavaScript-only live values', (t) => {
    const client = new Database(':memory:');
    t.after(() => client.close());
    const reporter = () => undefined;
    const javascript = resolveGtfsConfig({
      database: { client },
      reporting: { reporter },
      sources: [
        {
          sourceId: 'metro',
          schedule: {
            path: './gtfs.zip',
            import: { csv: { trim: false } },
          },
        },
      ],
    });
    assert.equal(javascript.reporting.reporter, reporter);

    const json = configError(() =>
      resolveGtfsConfig(
        {
          database: { client: {} },
          reporting: { reporter },
          sources: [
            {
              sourceId: 'metro',
              schedule: {
                path: './gtfs.zip',
                import: { csv: { trim: false } },
              },
            },
          ],
        },
        { format: 'json' },
      ),
    );
    assert.match(json.message, /database\.client/);
    assert.match(json.message, /reporting\.reporter/);
  });

  test('accepts and freezes an explicit extension selection', () => {
    const resolved = resolveGtfsConfig({
      database: {},
      extensions: ['gtfs-plus', 'tides'],
      sources: [{ sourceId: 'metro', schedule: { path: './gtfs.zip' } }],
    });
    assert.deepEqual(resolved.extensions, ['gtfs-plus', 'tides']);
    assert.equal(Object.isFrozen(resolved.extensions), true);
  });

  test('rejects extension selections that are neither arrays nor import auto-detection', () => {
    for (const extensions of ['gtfs-plus', true, 1, {}, null]) {
      const error = configError(() =>
        resolveGtfsConfig({
          database: {},
          extensions,
          sources: [{ schedule: { path: './gtfs.zip' } }],
        } as never),
      );
      assert.match(error.message, /`extensions` must be an array/);
    }
  });

  test('provides operation-specific immutable results', () => {
    const shared = {
      database: { path: ':memory:' },
      extensions: ['gtfs-realtime'],
      sources: [
        {
          schedule: { path: './gtfs.zip' },
          realtime: {
            feeds: [
              {
                feedId: 'main',
                url: 'https://example.com/realtime.pb',
              },
            ],
          },
        },
      ],
    } as const;

    const schedule = resolveGtfsImportConfig(shared).sources[0]!.schedule;
    assert.equal(
      resolveGtfsImportConfig(shared).sources[0]!.sourceId,
      'default',
    );
    assert.ok('path' in schedule);
    assert.equal(schedule.path, './gtfs.zip');
    const realtime = resolveGtfsInstanceConfig(shared).sources[0]?.realtime;
    assert.ok(realtime);
    assert.equal(realtime.feeds[0]?.feedId, 'main');
    assert.deepEqual(resolveGtfsExportConfig(shared).extensions, [
      'gtfs-realtime',
    ]);
    assert.deepEqual(resolveGtfsInstanceConfig(shared).extensions, [
      'gtfs-realtime',
    ]);
  });
});
