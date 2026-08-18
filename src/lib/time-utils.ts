import Long from 'long';

import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from './errors.ts';

/**
 * Converts a Long timestamp to ISO date string
 * @param longDate Object containing high, low, and unsigned values
 * @returns ISO formatted date string
 */
export function convertLongTimeToDate(longDate: {
  high: number;
  low: number;
  unsigned: boolean;
}) {
  const { high, low, unsigned } = longDate;
  return new Date(
    Long.fromBits(low, high, unsigned).toNumber() * 1000,
  ).toISOString();
}

/**
 * Converts time string in HH:mm:ss format to seconds since midnight
 * @param time Time string in HH:mm:ss format
 * @returns Number of seconds since midnight, or null if invalid format
 */
export function calculateSecondsFromMidnight(time: string): number | null {
  if (!time || typeof time !== 'string') {
    return null;
  }

  const [hours, minutes, seconds] = time.split(':').map(Number);

  if ([hours, minutes, seconds].some(isNaN) || minutes >= 60 || seconds >= 60) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Ensures time components have leading zeros (e.g., "9:5:1" -> "09:05:01")
 * @param time Time string in HH:mm:ss format
 * @returns Formatted time string with leading zeros, or null if invalid format
 */
export function padLeadingZeros(time: string) {
  const split = time.split(':').map((d) => String(Number(d)).padStart(2, '0'));
  if (split.length !== 3) {
    return null;
  }

  return split.join(':');
}

/**
 * Gets day of week name from YYYYMMDD date number
 * @param date Date in YYYYMMDD format
 * @returns Lowercase day name (sunday-saturday)
 */
export function getDayOfWeekFromDate(date: number): string {
  const DAYS_OF_WEEK = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ] as const;

  if (!Number.isInteger(date) || date.toString().length !== 8) {
    throw new GtfsError('Date must be in YYYYMMDD format', {
      code: GtfsErrorCode.GTFS_INVALID_DATE,
      category: GtfsErrorCategory.VALIDATION,
      details: { value: date },
    });
  }

  const year = Math.floor(date / 10000);
  const month = Math.floor((date % 10000) / 100);
  const day = date % 100;

  const dateObj = new Date(year, month - 1, day);

  if (dateObj.toString() === 'Invalid Date') {
    throw new GtfsError('Invalid date', {
      code: GtfsErrorCode.GTFS_INVALID_DATE,
      category: GtfsErrorCategory.VALIDATION,
      details: { value: date },
    });
  }

  return DAYS_OF_WEEK[dateObj.getDay()];
}
