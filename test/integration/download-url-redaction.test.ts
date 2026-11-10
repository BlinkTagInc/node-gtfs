import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import {
  importGtfs,
  refreshGtfsRealtime,
  formatGtfsError,
  isGtfsError,
  type GtfsReportEvent,
} from '../../src/index.ts';

for (const kind of ['schedule', 'realtime'] as const) {
  for (const failure of ['http', 'redirect'] as const) {
    test(`${kind} redacts signed URLs in ${failure} errors and reporting, not requests`, async (t) => {
      const database = new Database(':memory:');
      t.after(() => database.close());
      const events: GtfsReportEvent[] = [];
      const url =
        'https://example.test/feed?route=red&agency=SF&sig=sas-secret&Policy=policy-secret&hmac=hmac-secret&GoogleAccessId=identity-secret';
      const safeUrl =
        'https://example.test/feed?route=red&agency=SF&sig=***&Policy=***&hmac=***&GoogleAccessId=***';
      const fetchMock = t.mock.method(
        globalThis,
        'fetch',
        async (input: string) => {
          assert.equal(
            input,
            url,
            'The actual request must retain its signed query',
          );
          return failure === 'http'
            ? new Response(null, { status: 403, statusText: 'Forbidden' })
            : new Response(null, {
                status: 302,
                headers: { Location: 'file:///untrusted/feed' },
              });
        },
      );
      const common = {
        database: { client: database },
        reporting: { reporter: (event: GtfsReportEvent) => events.push(event) },
      };
      const operation =
        kind === 'schedule'
          ? () => importGtfs({ ...common, sources: [{ schedule: { url } }] })
          : () =>
              refreshGtfsRealtime({
                ...common,
                extensions: ['gtfs-realtime'],
                sources: [{ realtime: { feeds: [{ type: 'alerts', url }] } }],
              });
      await assert.rejects(operation, (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(
          error.code,
          failure === 'http'
            ? 'GTFS_DOWNLOAD_HTTP_FAILED'
            : 'GTFS_DOWNLOAD_REDIRECT_REJECTED',
        );
        assert.equal(error.details?.url, safeUrl);
        const diagnostics = JSON.stringify({
          events,
          error,
          userMessage: formatGtfsError(error, { audience: 'user' }),
          developerMessage: formatGtfsError(error, { audience: 'developer' }),
        });
        assert.doesNotMatch(
          diagnostics,
          /sas-secret|policy-secret|hmac-secret|identity-secret/,
        );
        assert.ok(events.some((event) => event.message.includes(safeUrl)));
        assert.match(diagnostics, /route=red&agency=SF/);
        return true;
      });
      assert.equal(fetchMock.mock.callCount(), 1);
    });
  }
}
