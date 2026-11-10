/** Tests benchmark statistics and correctness fingerprints; never runs timings. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalValue, createDigest, summarize } from './metrics.mjs';

test('benchmark summaries use medians and nearest-rank percentiles', () => {
  assert.equal(summarize([4, 1, 2, 3]).median, 2.5);
  assert.equal(summarize([5, 1, 100]).median, 5);
  assert.equal(
    summarize(Array.from({ length: 20 }, (_, index) => index + 1)).p95,
    19,
  );
  assert.throws(() => summarize([]), /empty sample/);
});

test('benchmark fingerprints ignore ordering but preserve duplicates and values', () => {
  const fingerprint = (rows) => {
    const digest = createDigest();
    for (const row of rows) {
      digest.add(row);
    }
    return digest.result();
  };
  assert.deepEqual(fingerprint([['a'], ['b']]), fingerprint([['b'], ['a']]));
  assert.notDeepEqual(fingerprint([['a'], ['b']]), fingerprint([['a'], ['a']]));
  assert.notDeepEqual(fingerprint([['a']]), fingerprint([['a'], ['a']]));
});

test('benchmark canonicalization keeps IDs distinct and normalizes time and money representations', () => {
  assert.equal(canonicalValue('001'), '001');
  assert.equal(canonicalValue('001', { kind: 'integer' }), '1');
  assert.equal(canonicalValue('25:01:02', { kind: 'time' }), '90062');
  assert.throws(() => canonicalValue('1:2:3:4', { kind: 'time' }), /Invalid/);
  assert.equal(canonicalValue('', { kind: 'integer' }), null);
  assert.equal(
    canonicalValue(
      250,
      { monetary: {} },
      { storedMoney: true, currency: 'USD' },
    ),
    '2.5',
  );
  assert.equal(canonicalValue('-0002.500', { monetary: {} }), '-2.5');
  assert.equal(
    canonicalValue(
      -250,
      { monetary: {} },
      { storedMoney: true, currency: 'USD' },
    ),
    '-2.5',
  );
  assert.equal(
    canonicalValue(
      250,
      { monetary: {} },
      { storedMoney: true, currency: 'JPY' },
    ),
    '250',
  );
  assert.equal(
    canonicalValue('9007199254740993.01', { monetary: {} }),
    '9007199254740993.01',
  );
  assert.equal(canonicalValue('1e-7', { monetary: {} }), '0.0000001');
});
