import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveGtfsConfig } from '../../src/config/resolver.ts';
import { resolveScheduleSource } from '../../src/config/schedule.ts';
import {
  resolveSourceRealtimeFeeds,
  resolveRealtimeRetention,
} from '../../src/config/realtime.ts';
import { isGtfsError } from '../../src/diagnostics/errors.ts';
import type { ConfigValidationContext } from '../../src/config/validation.ts';

const context = (): ConfigValidationContext => ({
  format: 'javascript',
  operation: 'instance',
  issues: [],
});

describe('configuration domain contracts', () => {
  it('uses distinct timeout defaults while sharing download validation between Schedule and Realtime', () => {
    for (const options of [
      {},
      {
        requestHeaders: { Authorization: 'Bearer token', Empty: '' },
        timeoutMs: 1,
      },
      { timeoutMs: Number.MAX_SAFE_INTEGER },
      ...[
        0,
        -1,
        0.5,
        Number.MAX_SAFE_INTEGER + 1,
        NaN,
        Infinity,
        '1000',
        null,
      ].map((timeoutMs) => ({ timeoutMs })),
      { requestHeaders: [] },
      { requestHeaders: { Authorization: undefined, Other: 1 } },
    ]) {
      const scheduleContext = context();
      const realtimeContext = context();
      const schedulePath = 'sources[0].schedule';
      const realtimePath = 'sources[0].realtime.feeds[0]';
      const schedule = resolveScheduleSource(
        { url: 'https://example.com/feed.zip', ...options },
        schedulePath,
        scheduleContext,
      );
      const realtime = resolveSourceRealtimeFeeds(
        {
          feeds: [
            { type: 'alerts', url: 'https://example.com/alerts', ...options },
          ],
        },
        'sources[0].realtime',
        realtimeContext,
      )?.feeds[0];
      assert.ok(schedule && 'url' in schedule);
      assert.ok(realtime);
      assert.deepEqual(schedule.requestHeaders, realtime.requestHeaders);
      assert.equal(Object.isFrozen(schedule.requestHeaders), true);
      assert.equal(Object.isFrozen(realtime.requestHeaders), true);
      const normalizedIssues = (
        validation: ConfigValidationContext,
        endpointPath: string,
      ) =>
        validation.issues.map((issue) => ({
          ...issue,
          path: issue.path.replace(endpointPath, 'endpoint'),
          message: issue.message.replaceAll(endpointPath, 'endpoint'),
        }));
      assert.deepEqual(
        normalizedIssues(scheduleContext, schedulePath),
        normalizedIssues(realtimeContext, realtimePath),
      );
      if ('timeoutMs' in options) {
        const valid =
          typeof options.timeoutMs === 'number' &&
          Number.isSafeInteger(options.timeoutMs) &&
          options.timeoutMs > 0;
        assert.equal(schedule.timeoutMs, valid ? options.timeoutMs : 120_000);
        assert.equal(realtime.timeoutMs, valid ? options.timeoutMs : 30_000);
        assert.equal(
          scheduleContext.issues.some(({ path }) =>
            path.endsWith('.timeoutMs'),
          ),
          !valid,
        );
      } else {
        assert.equal(schedule.timeoutMs, 120_000);
        assert.equal(realtime.timeoutMs, 30_000);
      }
    }
  });

  for (const setting of [
    'currentEntitiesSeconds',
    'snapshotsSeconds',
  ] as const) {
    it(`requires whole-second ${setting}, with null only for snapshot history`, () => {
      for (const value of [
        undefined,
        null,
        0,
        1,
        100,
        Number.MAX_SAFE_INTEGER,
        0.25,
        -0.5,
        -1,
        Number.MAX_SAFE_INTEGER + 1,
        Infinity,
        -Infinity,
        NaN,
        '10',
        true,
        {},
        [],
      ]) {
        const validation = context();
        const realtime = { retention: { [setting]: value } };
        const result = resolveRealtimeRetention(realtime, validation);
        const valid =
          value === undefined ||
          (value === null && setting === 'snapshotsSeconds') ||
          (typeof value === 'number' &&
            Number.isSafeInteger(value) &&
            value >= 0);
        const defaultValue = setting === 'snapshotsSeconds' ? 86_400 : 30;
        assert.equal(
          result.retention[setting],
          valid && value !== undefined ? value : defaultValue,
        );
        const issues = valid
          ? []
          : [
              {
                reason: 'invalid-value',
                path: `realtime.retention.${setting}`,
                message: `Configuration option \`realtime.retention.${setting}\` must be a non-negative safe integer${setting === 'snapshotsSeconds' ? ' or null' : ''}`,
              },
            ];
        assert.deepEqual(validation.issues, issues);
        assert.equal(Object.isFrozen(result.retention), true);
        if (!valid) {
          assert.throws(
            () => resolveGtfsConfig({ database: {}, realtime }),
            (error) => {
              assert.ok(isGtfsError(error));
              assert.equal(error.code, 'GTFS_CONFIG_INVALID');
              assert.deepEqual(error.details?.errors, issues);
              return true;
            },
          );
        }
      }
    });
  }

  it('accumulates errors from every configuration domain', () => {
    assert.throws(
      () =>
        resolveGtfsConfig({
          database: { client: {} },
          reporting: { level: 'loud' },
          extensions: ['unknown'],
          sources: [
            {
              schedule: {
                url: 'https://example.com/feed.zip',
                requestHeaders: { Authorization: 1 },
                timeoutMs: 0,
              },
              realtime: {
                feeds: [
                  {
                    type: 'alerts',
                    url: 'https://example.com/alerts',
                    requestHeaders: { Authorization: 2 },
                    timeoutMs: 0,
                  },
                ],
              },
            },
          ],
          realtime: {
            retention: { snapshotsSeconds: -1, currentEntitiesSeconds: -1 },
          },
          export: { batchSize: 0.5 },
        }),
      (error) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, 'GTFS_CONFIG_INVALID');
        assert.equal(error.category, 'config');
        assert.equal(error.details?.reason, 'multiple-config-errors');
        const issues = error.details?.errors;
        assert.ok(Array.isArray(issues));
        assert.deepEqual(
          issues.map(({ path }) => path),
          [
            'database.client',
            'reporting.level',
            'extensions[0]',
            'sources[0].schedule.requestHeaders.Authorization',
            'sources[0].schedule.timeoutMs',
            'sources[0].realtime.feeds[0].requestHeaders.Authorization',
            'sources[0].realtime.feeds[0].timeoutMs',
            'realtime.retention.snapshotsSeconds',
            'realtime.retention.currentEntitiesSeconds',
            'export.batchSize',
          ],
        );
        return true;
      },
    );
  });
});
