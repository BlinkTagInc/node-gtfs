import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import type { IncomingHttpHeaders } from 'node:http';
import { startTestHttpServer } from '../helpers/http-server.ts';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import {
  importGtfs,
  refreshGtfsRealtime,
  isGtfsError,
  type GtfsReportEvent,
} from '../../src/index.ts';
import { encodeZipFixture } from '../helpers/zip-fixture.ts';

for (const kind of ['schedule', 'realtime'] as const) {
  for (const outcome of [
    'success',
    'unauthorized',
    'rejected-redirect',
  ] as const) {
    test(
      `${kind} scopes headers across real redirect servers: ${outcome}`,
      { timeout: 10_000 },
      async (t) => {
        const database = new Database(':memory:');
        t.after(() => database.close());
        const fixture = 'test/fixtures/complete';
        const payload =
          kind === 'schedule'
            ? encodeZipFixture(
                await Promise.all(
                  (await readdir(fixture)).map(async (name) => ({
                    name,
                    content: await readFile(`${fixture}/${name}`),
                  })),
                ),
              )
            : Buffer.from(
                GtfsRealtimeBindings.transit_realtime.FeedMessage.encode({
                  header: { gtfsRealtimeVersion: '2.0' },
                  entity: [
                    {
                      id: 'redirected-alert',
                      alert: {
                        headerText: {
                          translation: [{ text: 'Redirected alert' }],
                        },
                        descriptionText: {
                          translation: [
                            { text: 'Downloaded through two origins' },
                          ],
                        },
                        informedEntity: [{ stopId: 'stop-1' }],
                      },
                    },
                  ],
                }).finish(),
              );
        const requests: Array<{
          path: string | undefined;
          headers: IncomingHttpHeaders;
        }> = [];
        const firstOrigin = await startTestHttpServer(
          t,
          (request, response) => {
            requests.push({ path: request.url, headers: request.headers });
            if (request.url === '/start') {
              response.writeHead(302, { Location: '/same-origin' });
              // Do not finish the redirect body: following it must cancel, not drain.
              response.write('redirect body');
            } else if (request.url === '/same-origin') {
              response.writeHead(307, {
                Location: `${secondOrigin}/cross-origin`,
              });
              response.end();
            } else if (request.url === '/returned') {
              response.end(payload);
            } else {
              response.writeHead(404);
              response.end();
            }
          },
        );
        const secondOrigin = await startTestHttpServer(
          t,
          (request, response) => {
            requests.push({ path: request.url, headers: request.headers });
            if (outcome === 'unauthorized') {
              response.writeHead(401);
              response.end('authentication required');
            } else {
              response.writeHead(308, {
                Location:
                  outcome === 'rejected-redirect'
                    ? 'https://user:redirect-secret@example.test/feed'
                    : `${firstOrigin}/returned`,
              });
              response.end();
            }
          },
        );
        const events: GtfsReportEvent[] = [];
        const common = {
          database: { client: database },
          reporting: {
            reporter: (event: GtfsReportEvent) => events.push(event),
          },
        };
        const endpoint = {
          url: `${firstOrigin}/start`,
          requestHeaders: {
            Authorization: 'Bearer auth-secret',
            Cookie: 'session=cookie-secret',
            'x-API-kEy': 'api-secret',
            'X-Custom-Auth': 'custom-secret',
            'User-Agent': 'private-agent',
          },
        };
        const run = () =>
          kind === 'schedule'
            ? importGtfs({ ...common, sources: [{ schedule: endpoint }] })
            : refreshGtfsRealtime({
                ...common,
                extensions: ['gtfs-realtime'],
                sources: [
                  { realtime: { feeds: [{ ...endpoint, type: 'alerts' }] } },
                ],
              });
        if (outcome === 'success') {
          const result = await run();
          assert.equal(result.success, true);
          if (kind === 'schedule') {
            assert.ok(
              database.prepare('SELECT * FROM agency').all().length > 0,
            );
          } else {
            assert.deepEqual(
              database.prepare('SELECT entity_id FROM alerts').all(),
              [{ entity_id: 'redirected-alert' }],
            );
            assert.equal(
              database.prepare('SELECT * FROM realtime_snapshots').all().length,
              1,
            );
          }
        } else {
          await assert.rejects(run(), (error: unknown) => {
            assert.ok(isGtfsError(error));
            assert.equal(
              error.code,
              outcome === 'unauthorized'
                ? 'GTFS_DOWNLOAD_HTTP_FAILED'
                : 'GTFS_DOWNLOAD_REDIRECT_REJECTED',
            );
            assert.equal(error.category, 'download');
            if (outcome === 'unauthorized') {
              assert.equal(error.statusCode, 401);
            } else {
              assert.equal(error.details?.reason, 'redirect-credentials');
              assert.equal(error.details?.redirectCount, 2);
            }
            assert.doesNotMatch(
              JSON.stringify(error) + error.message,
              /auth-secret|cookie-secret|api-secret|custom-secret|redirect-secret/,
            );
            return true;
          });
          const table = kind === 'schedule' ? 'agency' : 'realtime_snapshots';
          assert.deepEqual(
            database.prepare(`SELECT * FROM ${table}`).all(),
            [],
          );
          assert.ok(
            !events.some((event) => event.message.includes('retrying')),
          );
        }
        assert.deepEqual(
          requests.map((request) => request.path),
          outcome === 'success'
            ? ['/start', '/same-origin', '/cross-origin', '/returned']
            : ['/start', '/same-origin', '/cross-origin'],
        );
        for (const [index, request] of requests.entries()) {
          if (index < 2) {
            assert.equal(request.headers.authorization, 'Bearer auth-secret');
            assert.equal(request.headers.cookie, 'session=cookie-secret');
            assert.equal(request.headers['x-api-key'], 'api-secret');
            assert.equal(request.headers['x-custom-auth'], 'custom-secret');
            assert.equal(request.headers['user-agent'], 'private-agent');
          } else {
            assert.equal(request.headers.authorization, undefined);
            assert.equal(request.headers.cookie, undefined);
            assert.equal(request.headers['x-api-key'], undefined);
            assert.equal(request.headers['x-custom-auth'], undefined);
            assert.equal(request.headers['user-agent'], 'node-gtfs');
          }
        }
        assert.doesNotMatch(
          JSON.stringify(events),
          /auth-secret|cookie-secret|api-secret|custom-secret|redirect-secret/,
        );
      },
    );
  }
}
