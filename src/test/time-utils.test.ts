import { describe, it, expect } from './test-utils.ts';
import {
  calculateSecondsFromMidnight,
  convertLongTimeToDate,
  getDayOfWeekFromDate,
  padLeadingZeros,
} from '../lib/time-utils.ts';

describe('calculateSecondsFromMidnight()', () => {
  it('should convert a padded time', () => {
    expect(calculateSecondsFromMidnight('00:00:00')).toBe(0);
    expect(calculateSecondsFromMidnight('01:00:00')).toBe(3600);
    expect(calculateSecondsFromMidnight('09:05:01')).toBe(32_701);
    expect(calculateSecondsFromMidnight('23:59:59')).toBe(86_399);
  });

  it('should convert an unpadded time', () => {
    expect(calculateSecondsFromMidnight('9:05:01')).toBe(32_701);
  });

  it('should support GTFS times past midnight', () => {
    // GTFS allows hours >= 24 for trips continuing past midnight, so these
    // must keep counting up rather than wrapping.
    expect(calculateSecondsFromMidnight('24:00:00')).toBe(86_400);
    expect(calculateSecondsFromMidnight('25:30:00')).toBe(91_800);
    expect(calculateSecondsFromMidnight('27:15:30')).toBe(98_130);
  });

  it('should return null for invalid input', () => {
    expect(calculateSecondsFromMidnight('')).toBeNull();
    expect(calculateSecondsFromMidnight('not-a-time')).toBeNull();
    expect(calculateSecondsFromMidnight('12:60:00')).toBeNull();
    expect(calculateSecondsFromMidnight('12:00:60')).toBeNull();
    expect(
      calculateSecondsFromMidnight(undefined as unknown as string),
    ).toBeNull();
    expect(calculateSecondsFromMidnight(1200 as unknown as string)).toBeNull();
  });
});

describe('padLeadingZeros()', () => {
  it('should pad each component to two digits', () => {
    expect(padLeadingZeros('9:5:1')).toBe('09:05:01');
    expect(padLeadingZeros('0:0:0')).toBe('00:00:00');
  });

  it('should leave already padded times unchanged', () => {
    expect(padLeadingZeros('09:05:01')).toBe('09:05:01');
    expect(padLeadingZeros('23:59:59')).toBe('23:59:59');
  });

  it('should not truncate hours past midnight', () => {
    expect(padLeadingZeros('25:30:00')).toBe('25:30:00');
  });

  it('should return null when the time does not have three components', () => {
    expect(padLeadingZeros('09:05')).toBeNull();
    expect(padLeadingZeros('')).toBeNull();
  });
});

describe('getDayOfWeekFromDate()', () => {
  it('should return the day name for a YYYYMMDD date', () => {
    // 2016-04-06 was a Wednesday.
    expect(getDayOfWeekFromDate(20_160_406)).toBe('wednesday');
    expect(getDayOfWeekFromDate(20_160_403)).toBe('sunday');
    expect(getDayOfWeekFromDate(20_160_409)).toBe('saturday');
  });

  it('should handle leap days', () => {
    expect(getDayOfWeekFromDate(20_200_229)).toBe('saturday');
  });

  it('should throw when the date is not eight digits', () => {
    expect(() => getDayOfWeekFromDate(2_016_040)).toThrow(
      'Date must be in YYYYMMDD format',
    );
    expect(() => getDayOfWeekFromDate(20_160_406.5)).toThrow(
      'Date must be in YYYYMMDD format',
    );
  });
});

describe('convertLongTimeToDate()', () => {
  it('should convert a Long-encoded seconds timestamp to an ISO string', () => {
    // 1_000_000_000 seconds since the epoch.
    expect(
      convertLongTimeToDate({ high: 0, low: 1_000_000_000, unsigned: true }),
    ).toBe('2001-09-09T01:46:40.000Z');
  });

  it('should convert the epoch itself', () => {
    expect(convertLongTimeToDate({ high: 0, low: 0, unsigned: true })).toBe(
      '1970-01-01T00:00:00.000Z',
    );
  });
});
