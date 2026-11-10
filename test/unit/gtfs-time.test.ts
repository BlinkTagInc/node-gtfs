import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GtfsErrorCategory,
  GtfsErrorCode,
  isGtfsError,
} from '../../src/diagnostics/errors.ts';
import {
  getServiceDateWeekday,
  parseGtfsTime,
  parseGtfsTimeToServiceDaySeconds,
} from '../../src/values/service-time.ts';

describe('parseGtfsTimeToServiceDaySeconds()', () => {
  it('should convert a padded time', () => {
    assert.equal(parseGtfsTimeToServiceDaySeconds('00:00:00'), 0);
    assert.equal(parseGtfsTimeToServiceDaySeconds('01:00:00'), 3600);
    assert.equal(parseGtfsTimeToServiceDaySeconds('09:05:01'), 32_701);
    assert.equal(parseGtfsTimeToServiceDaySeconds('23:59:59'), 86_399);
  });

  it('should convert an unpadded time', () => {
    assert.equal(parseGtfsTimeToServiceDaySeconds('9:05:01'), 32_701);
    assert.equal(parseGtfsTimeToServiceDaySeconds('1:2:3'), 3723);
  });

  it('should support GTFS times past midnight', () => {
    // GTFS allows hours >= 24 for trips continuing past midnight, so these
    // must keep counting up rather than wrapping.
    assert.equal(parseGtfsTimeToServiceDaySeconds('24:00:00'), 86_400);
    assert.equal(parseGtfsTimeToServiceDaySeconds('25:30:00'), 91_800);
    assert.equal(parseGtfsTimeToServiceDaySeconds('27:15:30'), 98_130);
  });

  it('should return null for invalid input', () => {
    assert.equal(parseGtfsTimeToServiceDaySeconds(''), null);
    assert.equal(parseGtfsTimeToServiceDaySeconds('not-a-time'), null);
    assert.equal(parseGtfsTimeToServiceDaySeconds('12:60:00'), null);
    assert.equal(parseGtfsTimeToServiceDaySeconds('12:00:60'), null);
    assert.equal(parseGtfsTimeToServiceDaySeconds('-1:00:00'), null);
    assert.equal(parseGtfsTimeToServiceDaySeconds('1:2:3:4'), null);
    assert.equal(
      parseGtfsTimeToServiceDaySeconds(undefined as unknown as string),
      null,
    );
    assert.equal(
      parseGtfsTimeToServiceDaySeconds(1200 as unknown as string),
      null,
    );
  });

  it('rejects malformed components and unsafe durations without numeric coercion', () => {
    for (const time of [
      '09::00',
      ':00:00',
      '09:00:',
      '1e2:00:00',
      '0x10:00:00',
      ' 09:00:00',
      '09:00:00 ',
      '+9:00:00',
      '09:000:00',
      '9007199254740991:00:00',
    ]) {
      assert.equal(parseGtfsTimeToServiceDaySeconds(time), null, time);
      assert.equal(parseGtfsTime(time), null, time);
    }
  });
});

describe('parseGtfsTime()', () => {
  it('normalizes extended and zero-prefixed hours without changing their duration', () => {
    for (const [input, normalized, seconds] of [
      ['000:0:0', '00:00:00', 0],
      ['0009:05:01', '09:05:01', 32701],
      ['100:2:3', '100:02:03', 360123],
      ['1234:59:59', '1234:59:59', 4445999],
    ] as const) {
      assert.deepEqual(parseGtfsTime(input), {
        normalized,
        serviceDaySeconds: seconds,
      });
    }
  });

  it('preserves exact seconds throughout padded and unpadded time components', () => {
    for (const hours of [0, 1, 9, 23, 24, 99, 100]) {
      for (let minutes = 0; minutes < 60; minutes += 1) {
        for (let seconds = 0; seconds < 60; seconds += 1) {
          const normalized = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
          const expected = {
            normalized,
            serviceDaySeconds: hours * 3600 + minutes * 60 + seconds,
          };
          assert.deepEqual(
            parseGtfsTime(`${hours}:${minutes}:${seconds}`),
            expected,
          );
          assert.deepEqual(parseGtfsTime(normalized), expected);
        }
      }
    }
  });

  it('checks the exact safe-integer duration boundary', () => {
    const maximum = BigInt(Number.MAX_SAFE_INTEGER);
    for (const value of [maximum - 1n, maximum, maximum + 1n, maximum + 2n]) {
      const time = `${value / 3600n}:${(value / 60n) % 60n}:${value % 60n}`;
      assert.equal(
        parseGtfsTimeToServiceDaySeconds(time),
        value <= maximum ? Number(value) : null,
      );
    }
  });
});

describe('getServiceDateWeekday()', () => {
  it('should return the day name for a YYYYMMDD date', () => {
    // 2016-04-06 was a Wednesday.
    assert.equal(getServiceDateWeekday(20_160_406), 'wednesday');
    assert.equal(getServiceDateWeekday(20_160_403), 'sunday');
    assert.equal(getServiceDateWeekday(20_160_409), 'saturday');
  });

  it('should handle leap days', () => {
    assert.equal(getServiceDateWeekday(20_200_229), 'saturday');
  });

  it('should throw when the date is not eight digits', () => {
    assert.throws(
      () => getServiceDateWeekday(2_016_040),
      /expected a valid date in YYYYMMDD format/,
    );
    assert.throws(
      () => getServiceDateWeekday(20_160_406.5),
      /expected a valid date in YYYYMMDD format/,
    );
  });

  it('should throw when the calendar date does not exist', () => {
    assert.throws(
      () => getServiceDateWeekday(20_260_230),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.INVALID_DATE);
        assert.equal(error.category, GtfsErrorCategory.VALIDATION);
        assert.deepEqual(error.details, { value: 20_260_230 });
        assert.match(error.message, /expected a valid date in YYYYMMDD format/);
        return true;
      },
    );
  });
});
