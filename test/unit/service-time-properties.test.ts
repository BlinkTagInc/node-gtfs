import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import {
  parseGtfsTime,
  parseGtfsTimeToServiceDaySeconds,
} from '../../src/values/service-time.ts';
import { propertyOptions } from '../helpers/property-options.ts';

const maximum = BigInt(Number.MAX_SAFE_INTEGER);
const duration = fc.oneof(
  fc.bigInt({ min: 0n, max: maximum + 100_000n }),
  fc.constantFrom(0n, 86_400n, maximum - 1n, maximum, maximum + 1n),
);

test('property: service times preserve exact duration or reject unsafe seconds', () => {
  fc.assert(
    fc.property(
      duration,
      fc.integer({ min: 0, max: 5 }),
      fc.boolean(),
      (seconds, leadingZeroes, padded) => {
        // BigInt is the oracle; production parses and adds Number components.
        const hours = seconds / 3600n;
        const minutes = (seconds / 60n) % 60n;
        const remainder = seconds % 60n;
        const width = padded ? 2 : 1;
        const input = `${'0'.repeat(leadingZeroes)}${hours}:${String(minutes).padStart(width, '0')}:${String(remainder).padStart(width, '0')}`;
        if (seconds > maximum) {
          assert.equal(parseGtfsTime(input), null);
          assert.equal(parseGtfsTimeToServiceDaySeconds(input), null);
        } else {
          assert.deepEqual(parseGtfsTime(input), {
            normalized: [hours, minutes, remainder]
              .map((value) => String(value).padStart(2, '0'))
              .join(':'),
            serviceDaySeconds: Number(seconds),
          });
          assert.equal(
            parseGtfsTimeToServiceDaySeconds(input),
            Number(seconds),
          );
        }
      },
    ),
    propertyOptions(13002, 300),
  );
});

test('property: invalid service-time components cannot be coerced into valid times', () => {
  fc.assert(
    fc.property(
      fc.nat(1000),
      fc.integer({ min: 60, max: 999 }),
      (hours, invalidComponent) => {
        for (const input of [
          `${hours}:${invalidComponent}:00`,
          `${hours}:00:${invalidComponent}`,
          `+${hours}:00:00`,
          `${hours}e0:00:00`,
          `${hours}::00`,
          `${hours}:00:00 `,
        ]) {
          assert.equal(parseGtfsTime(input), null, input);
        }
      },
    ),
    propertyOptions(13003, 100),
  );
});
