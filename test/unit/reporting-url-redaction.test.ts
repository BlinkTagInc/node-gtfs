import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactUrlForReporting } from '../../src/reporting/format.ts';

for (const { name, sensitive, visible } of [
  {
    name: 'Azure SAS',
    sensitive: ['sig'],
    visible: { sv: '2024-11-04', sp: 'r', sr: 'b', se: '2026-09-15' },
  },
  {
    name: 'AWS S3',
    sensitive: [
      'X-Amz-Signature',
      'X-Amz-Credential',
      'X-Amz-Security-Token',
      'AWSAccessKeyId',
    ],
    visible: {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Expires': '3600',
      'X-Amz-SignedHeaders': 'host',
    },
  },
  {
    name: 'CloudFront',
    sensitive: ['Signature', 'Policy', 'Key-Pair-Id'],
    visible: { Expires: '1790000000' },
  },
  {
    name: 'Google Cloud Storage',
    sensitive: [
      'GoogleAccessId',
      'Signature',
      'X-Goog-Signature',
      'X-Goog-Credential',
    ],
    visible: {
      'X-Goog-Algorithm': 'GOOG4-RSA-SHA256',
      'X-Goog-Expires': '3600',
      'X-Goog-SignedHeaders': 'host',
    },
  },
  {
    name: 'CDN and authentication credentials',
    sensitive: [
      'hmac',
      'jwt',
      'bearer',
      'code',
      'assertion',
      'ticket',
      'SAMLRequest',
      'SAMLResponse',
      'hdnts',
      'hdntl',
    ],
    visible: { format: 'protobuf' },
  },
  {
    name: 'credential-name fragments',
    sensitive: [
      'api_key',
      'clientSecret',
      'access_token',
      'password',
      'passwd',
      'passphrase',
      'pwd',
      'credential',
      'authorization',
      'oauth_nonce',
      'url_signature',
      'session_id',
    ],
    visible: { format: 'zip' },
  },
]) {
  test(`redacts ${name} query credentials while retaining other parameters`, () => {
    const url = new URL('https://feeds.example.test/feed');
    url.searchParams.set('route_id', 'red');
    url.searchParams.set('agency', 'SF');
    for (const parameter of sensitive) {
      url.searchParams.append(parameter, `secret-${parameter}`);
    }
    for (const [parameter, value] of Object.entries(visible)) {
      url.searchParams.append(parameter, value);
    }
    const original = url.href;
    const redacted = new URL(redactUrlForReporting(original));
    assert.deepEqual(
      [...redacted.searchParams.keys()],
      [...url.searchParams.keys()],
    );
    for (const parameter of sensitive) {
      assert.equal(redacted.searchParams.get(parameter), '***', parameter);
    }
    for (const [parameter, value] of Object.entries(visible)) {
      assert.equal(redacted.searchParams.get(parameter), value);
    }
    assert.equal(redacted.searchParams.get('route_id'), 'red');
    assert.equal(redacted.searchParams.get('agency'), 'SF');
    assert.doesNotMatch(redacted.href, /secret-/);
    assert.equal(url.href, original);
  });
}

test('redacts case variants and encoded names without losing duplicate parameters or their order', () => {
  assert.equal(
    redactUrlForReporting(
      'https://feed-user:feed-password@example.test/feed.zip?route=red&%73%69%67=first-secret&route=blue&sig=second-secret&SiG=third-secret&%50olicy=policy-secret&API_KEY=key-secret&label=Caf%C3%A9%20%26%20rail&empty=#private',
    ),
    'https://example.test/feed.zip?route=red&sig=***&route=blue&sig=***&SiG=***&Policy=***&API_KEY=***&label=Caf%C3%A9+%26+rail&empty=',
  );
});

test('keeps ordinary query values even when names resemble short credential names', () => {
  const url =
    'https://example.test/feed.zip?signal=green&design=map&assigned_stop_id=central&stop_code=123&route_code=red&policy_version=2&expires=1790000000&limit=100&offset=0';
  assert.equal(redactUrlForReporting(url), url);
});

test('removes user information and fragments without adding an empty query string', () => {
  assert.equal(
    redactUrlForReporting('https://user:secret@example.test/feed.zip#private'),
    'https://example.test/feed.zip',
  );
});
