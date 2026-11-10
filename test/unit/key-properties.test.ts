import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import {
  digestGtfsCanonicalKey,
  encodeGtfsCanonicalKey,
} from '../../src/database/storage/key.ts';
import { propertyOptions } from '../helpers/property-options.ts';

const text = fc.oneof(
  fc.string({ maxLength: 24 }),
  fc.constantFrom(
    '',
    'null',
    '0',
    '\u0000',
    '__proto__',
    '[0],[1,""]',
    'é',
    'e\u0301',
    '東京💡',
  ),
);
const part = fc.oneof(
  fc.constant(null),
  text,
  fc.integer(),
  fc.bigInt({ min: -(2n ** 70n), max: 2n ** 70n }),
);
const key = fc.array(part, { maxLength: 8 });

test('property: canonical keys preserve tuple and scalar distinctions', () => {
  fc.assert(
    fc.property(key, key, (left, right) => {
      // Numeric integers and their BigInt representations denote the same key;
      // null and strings retain their own types. No production encoding is decoded.
      const equal =
        left.length === right.length &&
        left.every((value, index) => {
          const other = right[index];
          if (
            (typeof value === 'number' || typeof value === 'bigint') &&
            (typeof other === 'number' || typeof other === 'bigint')
          ) {
            return BigInt(value) === BigInt(other);
          }
          return value === other;
        });
      assert.equal(
        encodeGtfsCanonicalKey(left) === encodeGtfsCanonicalKey(right),
        equal,
      );
      assert.equal(
        digestGtfsCanonicalKey(left) === digestGtfsCanonicalKey(right),
        equal,
      );
    }),
    propertyOptions(13004, 300),
  );
});

test('property: key boundaries and numeric tags cannot collide with identifier text', () => {
  fc.assert(
    fc.property(text, text, fc.integer(), (left, right, number) => {
      assert.notEqual(
        encodeGtfsCanonicalKey([left, right]),
        encodeGtfsCanonicalKey([left + right]),
      );
      assert.notEqual(
        encodeGtfsCanonicalKey([null, left, right]),
        encodeGtfsCanonicalKey(['', left, right]),
      );
      assert.notEqual(
        encodeGtfsCanonicalKey([number]),
        encodeGtfsCanonicalKey([String(number)]),
      );
      assert.equal(
        encodeGtfsCanonicalKey([number]),
        encodeGtfsCanonicalKey([BigInt(number)]),
      );
    }),
    propertyOptions(13005, 200),
  );
});
