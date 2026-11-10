import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  bufferBoundedResponse,
  readBoundedResponse,
} from '../../src/io/limits.ts';
import { resolveGtfsConfig } from '../../src/config/resolver.ts';
import { GtfsErrorCode, isGtfsError } from '../../src/diagnostics/errors.ts';

for (const declaredLength of [undefined, '9', '1000000000000']) {
  test(`bounds response bytes and cancels the body (content-length ${declaredLength})`, async () => {
    let pulls = 0;
    let canceled = false;
    const response = new Response(
      new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            pulls++;
            controller.enqueue(new Uint8Array(6));
          },
          cancel() {
            canceled = true;
          },
        },
        { highWaterMark: 0 },
      ),
      {
        headers:
          declaredLength === undefined
            ? {}
            : { 'content-length': declaredLength },
      },
    );
    let accepted = 0;
    await assert.rejects(
      async () => {
        for await (const chunk of readBoundedResponse({
          response,
          maxBytes: 10,
          limit: 'maxDownloadBytes',
          details: { url: 'https://example.com/feed' },
        })) {
          accepted += chunk.byteLength;
        }
      },
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.DOWNLOAD_TOO_LARGE);
        assert.equal(error.category, 'download');
        assert.equal(error.details?.limit, 'maxDownloadBytes');
        assert.equal(error.details?.maximum, 10);
        assert.equal(
          error.details?.actual,
          declaredLength === '1000000000000' ? 1e12 : 12,
        );
        return true;
      },
    );
    assert.equal(canceled, true);
    assert.equal(response.body?.locked, false);
    assert.equal(pulls, declaredLength === '1000000000000' ? 0 : 2);
    assert.ok(accepted <= 10);
  });
}

test('accepts the exact download boundary and cancels when the consumer stops', async () => {
  const content = new Uint8Array(10).fill(5);
  const chunks = [];
  for await (const chunk of readBoundedResponse({
    response: new Response(content),
    maxBytes: 10,
    limit: 'maxDownloadBytes',
    details: {},
  })) {
    chunks.push(chunk);
  }
  assert.deepEqual(Buffer.concat(chunks), Buffer.from(content));
  let canceled = false;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(content);
      },
      cancel() {
        canceled = true;
      },
    }),
  );
  const failure = new Error('Destination write failed');
  await assert.rejects(
    async () => {
      for await (const _chunk of readBoundedResponse({
        response,
        maxBytes: 20,
        limit: 'maxCompressedBytes',
        details: {},
      })) {
        throw failure;
      }
    },
    (error) => error === failure,
  );
  assert.equal(canceled, true);
});

test('resource limits have finite defaults and reject invalid runtime configuration', () => {
  const schedule = { schedule: { path: './feed.zip' } };
  const defaults = resolveGtfsConfig({
    database: {},
    sources: [schedule],
  });
  assert.deepEqual(defaults.sources[0]?.schedule?.import.archive, {
    maxCompressedBytes: 1073741824,
    maxEntries: 1000,
    maxExtractedFileBytes: 4294967296,
    maxExtractedTotalBytes: 8589934592,
  });
  assert.equal(
    Object.isFrozen(defaults.sources[0]?.schedule?.import.archive),
    true,
  );
  const archive = {
    maxCompressedBytes: 1024,
    maxEntries: 2,
    maxExtractedFileBytes: 2048,
    maxExtractedTotalBytes: 4096,
  };
  const configured = resolveGtfsConfig({
    database: {},
    sources: [{ schedule: { path: './feed.zip', import: { archive } } }],
  });
  assert.deepEqual(configured.sources[0]?.schedule?.import.archive, archive);
  for (const key of [
    'maxCompressedBytes',
    'maxEntries',
    'maxExtractedFileBytes',
    'maxExtractedTotalBytes',
    'maxDownloadBytes',
  ]) {
    for (const value of [
      0,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      Infinity,
      NaN,
      null,
      '100',
    ]) {
      const realtime = key === 'maxDownloadBytes';
      assert.throws(
        () =>
          resolveGtfsConfig({
            database: {},
            sources: [
              realtime
                ? {
                    realtime: {
                      feeds: [
                        {
                          type: 'alerts',
                          url: 'https://example.com/alerts',
                          [key]: value,
                        },
                      ],
                    },
                  }
                : {
                    schedule: {
                      path: './feed.zip',
                      import: { archive: { [key]: value } },
                    },
                  },
            ],
          }),
        (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.CONFIG_INVALID);
          assert.match(error.message, new RegExp(key));
          return true;
        },
      );
    }
  }
  assert.throws(
    () =>
      resolveGtfsConfig({
        database: {},
        sources: [
          {
            schedule: { path: './feed.zip', import: { archive: { bogus: 1 } } },
          },
        ],
      }),
    /archive.bogus/,
  );
});

test('Realtime buffering preserves bytes across small chunks and block boundaries', async () => {
  const content = Uint8Array.from(
    { length: 2 * 65536 + 7 },
    (_, index) => index % 251,
  );
  let offset = 0;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset === content.byteLength) {
          controller.close();
        } else {
          const length = offset % 2 === 0 ? 1 : 117;
          controller.enqueue(content.subarray(offset, offset + length));
          offset = Math.min(offset + length, content.byteLength);
        }
      },
    }),
  );
  assert.deepEqual(
    await bufferBoundedResponse({
      response,
      maxBytes: content.byteLength,
      limit: 'maxDownloadBytes',
      details: {},
    }),
    Buffer.from(content),
  );
});
