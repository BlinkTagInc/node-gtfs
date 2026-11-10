import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchGtfsFeed } from '../../src/io/download.ts';
import { GtfsError, GtfsErrorCode } from '../../src/diagnostics/errors.ts';

const requestHeaders = Object.freeze({
  Authorization: 'Bearer auth-secret',
  Cookie: 'session=cookie-secret',
  'Proxy-Authorization': 'Basic proxy-secret',
  'x-API-kEy': 'custom-secret',
  'X-Agency-Credential': 'agency-secret',
  'User-Agent': 'custom-agent',
  Accept: 'application/octet-stream',
});

for (const status of [301, 302, 303, 307, 308]) {
  test(`follows ${status} relative redirects with same-origin headers and one signal`, async (t) => {
    const signal = new AbortController().signal;
    const finalResponse = new Response('feed');
    let calls = 0;
    let canceled = false;
    t.mock.method(
      globalThis,
      'fetch',
      async (input: string, init: RequestInit) => {
        assert.equal(init.redirect, 'manual');
        assert.equal(init.method, 'GET');
        assert.equal(init.signal, signal);
        assert.deepEqual(init.headers, requestHeaders);
        calls++;
        if (calls === 1) {
          assert.equal(input, 'https://feeds.example.test/current/start');
          return new Response(
            new ReadableStream({
              cancel() {
                canceled = true;
              },
            }),
            { status, headers: { Location: '../feed.zip' } },
          );
        }
        assert.ok(
          canceled,
          'Release the redirect body before the next request',
        );
        assert.equal(input, 'https://feeds.example.test/feed.zip');
        return finalResponse;
      },
    );
    const response = await fetchGtfsFeed({
      url: 'https://feeds.example.test/current/start',
      requestHeaders,
      signal,
    });
    assert.equal(response, finalResponse);
    assert.equal(await response.text(), 'feed');
    assert.equal(calls, 2);
  });
}

for (const { from, to, sameOrigin } of [
  {
    from: 'https://feeds.example.test/start',
    to: 'https://FEEDS.example.test:443/feed',
    sameOrigin: true,
  },
  {
    from: 'https://feeds.example.test/start',
    to: '//other.example.test/feed',
    sameOrigin: false,
  },
  {
    from: 'https://feeds.example.test/start',
    to: 'https://sub.feeds.example.test/feed',
    sameOrigin: false,
  },
  {
    from: 'https://feeds.example.test/start',
    to: 'https://feeds.example.test:444/feed',
    sameOrigin: false,
  },
  {
    from: 'http://feeds.example.test/start',
    to: 'https://feeds.example.test/feed',
    sameOrigin: false,
  },
]) {
  test(`scopes configured headers by origin: ${from} -> ${to}`, async (t) => {
    const calls: RequestInit[] = [];
    t.mock.method(
      globalThis,
      'fetch',
      async (_input: string, init: RequestInit) => {
        calls.push(init);
        if (calls.length === 1) {
          return new Response(null, { status: 302, headers: { Location: to } });
        }
        return new Response('feed');
      },
    );
    const response = await fetchGtfsFeed({
      url: from,
      requestHeaders,
      signal: new AbortController().signal,
      acceptEncoding: 'gzip',
    });
    await response.text();
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0]?.headers, {
      ...requestHeaders,
      'Accept-Encoding': 'gzip',
    });
    assert.deepEqual(
      calls[1]?.headers,
      sameOrigin
        ? { ...requestHeaders, 'Accept-Encoding': 'gzip' }
        : { 'User-Agent': 'node-gtfs', 'Accept-Encoding': 'gzip' },
    );
    assert.equal(requestHeaders['x-API-kEy'], 'custom-secret');
  });
}

test('never restores configured headers after leaving the original origin', async (t) => {
  const calls: Array<{ url: string; headers: RequestInit['headers'] }> = [];
  const locations = [
    'https://other.example.test/first',
    '/second',
    'https://feeds.example.test/return',
    '/final',
  ];
  t.mock.method(
    globalThis,
    'fetch',
    async (input: string, init: RequestInit) => {
      calls.push({ url: input, headers: init.headers });
      const location = locations.shift();
      return location === undefined
        ? new Response('feed')
        : new Response(null, { status: 302, headers: { Location: location } });
    },
  );
  await (
    await fetchGtfsFeed({
      url: 'https://feeds.example.test/start',
      requestHeaders,
      signal: new AbortController().signal,
    })
  ).text();
  assert.equal(calls.length, 5);
  assert.deepEqual(calls[0]?.headers, requestHeaders);
  for (const call of calls.slice(1)) {
    assert.deepEqual(call.headers, { 'User-Agent': 'node-gtfs' });
  }
  assert.equal(calls.at(-1)?.url, 'https://feeds.example.test/final');
});

for (const [location, reason] of [
  ['http://feeds.example.test/feed?token=redirect-secret', 'https-downgrade'],
  [
    'ftp://other.example.test/feed?token=redirect-secret',
    'unsupported-redirect-protocol',
  ],
  ['file:///tmp/redirect-secret', 'unsupported-redirect-protocol'],
  [
    'https://user:redirect-secret@other.example.test/feed',
    'redirect-credentials',
  ],
  ['https://[invalid/?token=redirect-secret', 'invalid-redirect-url'],
] as const) {
  test(`rejects ${reason} without fetching or exposing the redirect target`, async (t) => {
    let calls = 0;
    let canceled = false;
    t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      return new Response(
        new ReadableStream({
          cancel() {
            canceled = true;
          },
        }),
        { status: 302, headers: { Location: location } },
      );
    });
    await assert.rejects(
      fetchGtfsFeed({
        url: 'https://feeds.example.test/start?token=original-secret',
        requestHeaders,
        signal: new AbortController().signal,
      }),
      (error: unknown) => {
        assert.ok(error instanceof GtfsError);
        assert.equal(error.code, GtfsErrorCode.DOWNLOAD_REDIRECT_REJECTED);
        assert.equal(error.category, 'download');
        assert.equal(error.details?.reason, reason);
        assert.equal(error.details?.redirectCount, 0);
        assert.equal(error.cause, undefined);
        assert.doesNotMatch(
          JSON.stringify(error) + error.message,
          /redirect-secret|original-secret|custom-secret/,
        );
        return true;
      },
    );
    assert.equal(calls, 1);
    assert.ok(canceled);
  });
}

test('allows 20 redirects but cancels and rejects the next redirect', async (t) => {
  for (const redirects of [20, 21]) {
    let calls = 0;
    let cancellations = 0;
    const mock = t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      if (calls > redirects) {
        return new Response('feed');
      }
      return new Response(
        new ReadableStream({
          cancel() {
            cancellations++;
          },
        }),
        { status: 302, headers: { Location: '/loop' } },
      );
    });
    const download = fetchGtfsFeed({
      url: 'https://feeds.example.test/start',
      requestHeaders,
      signal: new AbortController().signal,
    });
    if (redirects === 20) {
      assert.equal(await (await download).text(), 'feed');
    } else {
      await assert.rejects(download, (error: unknown) => {
        assert.ok(error instanceof GtfsError);
        assert.equal(error.code, GtfsErrorCode.DOWNLOAD_REDIRECT_REJECTED);
        assert.equal(error.details?.reason, 'redirect-limit-exceeded');
        assert.equal(error.details?.redirectCount, 20);
        return true;
      });
    }
    assert.equal(calls, 21);
    assert.equal(cancellations, redirects);
    mock.mock.restore();
  }
});

test('returns redirects without Location and non-redirect HTTP responses unchanged', async (t) => {
  for (const response of [
    new Response(null, { status: 302 }),
    new Response(null, {
      status: 304,
      headers: { Location: '/not-a-redirect' },
    }),
    new Response('denied', { status: 401 }),
  ]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => response);
    assert.equal(
      await fetchGtfsFeed({
        url: 'https://feeds.example.test/start',
        requestHeaders,
        signal: new AbortController().signal,
      }),
      response,
    );
    assert.equal(mock.mock.callCount(), 1);
    await response.body?.cancel();
    mock.mock.restore();
  }
});

test('propagates aborts during redirects without starting another request', async (t) => {
  const controller = new AbortController();
  const timeout = new DOMException('Download timed out', 'TimeoutError');
  const mock = t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        new ReadableStream({
          cancel() {
            controller.abort(timeout);
            throw new Error('cancellation also failed');
          },
        }),
        { status: 302, headers: { Location: '/next' } },
      ),
  );
  await assert.rejects(
    fetchGtfsFeed({
      url: 'https://feeds.example.test/start',
      requestHeaders,
      signal: controller.signal,
    }),
    (error: unknown) => error === timeout,
  );
  assert.equal(mock.mock.callCount(), 1);
  await assert.rejects(
    fetchGtfsFeed({
      url: 'https://feeds.example.test/start',
      requestHeaders,
      signal: controller.signal,
    }),
    (error: unknown) => error === timeout,
  );
  assert.equal(mock.mock.callCount(), 1);
});
