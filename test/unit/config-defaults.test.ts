import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as defaults from '../../src/config/defaults.ts';
import { resolveGtfsConfig } from '../../src/config/resolver.ts';
import { report } from '../../src/reporting/report.ts';
import type { GtfsReportEvent } from '../../src/reporting/types.ts';

function minimalConfig() {
  return {
    database: {},
    sources: [
      {
        schedule: { url: 'https://example.test/feed.zip' },
        realtime: {
          feeds: [{ type: 'alerts', url: 'https://example.test/alerts.pb' }],
        },
      },
    ],
  };
}

test('all shared default objects and arrays are immutable', () => {
  function assertFrozen(value: unknown) {
    if (value === null || typeof value !== 'object') {
      return;
    }
    assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) {
      assertFrozen(child);
    }
  }
  for (const value of Object.values(defaults)) {
    assertFrozen(value);
  }
});

test('explicit false and zero values override defaults without affecting later resolutions', () => {
  const input = minimalConfig();
  const overridden = resolveGtfsConfig({
    ...input,
    export: { batchSize: 2, overwrite: true },
    realtime: {
      retention: { currentEntitiesSeconds: 0, snapshotsSeconds: null },
    },
    sources: [
      {
        ...input.sources[0],
        schedule: {
          url: 'https://example.test/feed.zip',
          timeoutMs: 1,
          requestHeaders: { Authorization: 'token' },
          excludeFiles: ['shapes.txt'],
          import: {
            csv: {
              quote: false,
              trim: false,
              skipEmptyLines: false,
              relaxQuotes: false,
            },
          },
        },
      },
    ],
  });
  const schedule = overridden.sources[0]?.schedule;
  assert.ok(schedule && 'url' in schedule);
  assert.equal(schedule.timeoutMs, 1);
  assert.deepEqual(schedule.requestHeaders, { Authorization: 'token' });
  assert.deepEqual(schedule.excludeFiles, ['shapes.txt']);
  assert.deepEqual(schedule.import.csv, {
    ...defaults.DEFAULT_GTFS_SCHEDULE_CONFIG.import.csv,
    quote: false,
    trim: false,
    skipEmptyLines: false,
    relaxQuotes: false,
  });
  assert.deepEqual(overridden.realtime.retention, {
    currentEntitiesSeconds: 0,
    snapshotsSeconds: null,
  });
  assert.deepEqual(overridden.export, { batchSize: 2, overwrite: true });
  assert.deepEqual(resolveGtfsConfig(minimalConfig()).sources[0]?.schedule, {
    ...defaults.DEFAULT_GTFS_SCHEDULE_CONFIG,
    url: 'https://example.test/feed.zip',
  });
});

test('reporting uses the same conditional default with or without config resolution', () => {
  const events: GtfsReportEvent[] = [];
  const reporter = (event: GtfsReportEvent) => {
    events.push(event);
  };
  const resolved = resolveGtfsConfig({
    ...minimalConfig(),
    reporting: { reporter },
  });
  assert.equal(
    resolved.reporting.level,
    defaults.DEFAULT_GTFS_REPORTING_LEVELS.withReporter,
  );
  report(
    { reporter },
    { type: 'message', level: 'info', message: 'Direct reporter' },
  );
  report(resolved.reporting, {
    type: 'message',
    level: 'info',
    message: 'Resolved reporter',
  });
  assert.deepEqual(
    events.map(({ message }) => message),
    ['Direct reporter', 'Resolved reporter'],
  );
});

test('null download headers remain invalid instead of receiving defaults', () => {
  for (const source of [
    {
      schedule: { url: 'https://example.test/feed.zip', requestHeaders: null },
    },
    {
      realtime: {
        feeds: [
          {
            type: 'alerts',
            url: 'https://example.test/alerts.pb',
            requestHeaders: null,
          },
        ],
      },
    },
  ]) {
    assert.throws(
      () => resolveGtfsConfig({ database: {}, sources: [source] }),
      {
        code: 'GTFS_CONFIG_INVALID',
        message: /requestHeaders/,
      },
    );
  }
});
