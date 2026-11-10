import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../diagnostics/errors.ts';

function parseGtfsTimeParts(time: string): {
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly serviceDaySeconds: number;
} | null {
  if (typeof time !== 'string' || !/^\d+:\d{1,2}:\d{1,2}$/u.test(time)) {
    return null;
  }

  const parts = time.split(':');
  const [hours = NaN, minutes = NaN, seconds = NaN] = parts.map(Number);

  if (
    [hours, minutes, seconds].some(
      (value) => !Number.isInteger(value) || value < 0,
    ) ||
    minutes >= 60 ||
    seconds >= 60
  ) {
    return null;
  }

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  if (!Number.isSafeInteger(totalSeconds)) {
    return null;
  }
  return {
    hours,
    minutes,
    seconds,
    serviceDaySeconds: totalSeconds,
  };
}

export function parseGtfsTimeToServiceDaySeconds(time: string): number | null {
  return parseGtfsTimeParts(time)?.serviceDaySeconds ?? null;
}

export function parseGtfsTime(
  time: string,
): { readonly normalized: string; readonly serviceDaySeconds: number } | null {
  const parts = parseGtfsTimeParts(time);
  if (parts === null) {
    return null;
  }
  return {
    normalized: [parts.hours, parts.minutes, parts.seconds]
      .map((part) => String(part).padStart(2, '0'))
      .join(':'),
    serviceDaySeconds: parts.serviceDaySeconds,
  };
}

export function getServiceDateWeekday(date: number): string {
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
    throw new GtfsError(
      `Invalid GTFS service date ${JSON.stringify(date)}; expected a valid date in YYYYMMDD format`,
      {
        code: GtfsErrorCode.INVALID_DATE,
        category: GtfsErrorCategory.VALIDATION,
        details: { value: date },
      },
    );
  }

  const year = Math.floor(date / 10000);
  const month = Math.floor((date % 10000) / 100);
  const day = date % 100;

  const dateObj = new Date(Date.UTC(year, month - 1, day));

  if (
    dateObj.getUTCFullYear() !== year ||
    dateObj.getUTCMonth() !== month - 1 ||
    dateObj.getUTCDate() !== day
  ) {
    throw new GtfsError(
      `Invalid GTFS service date ${JSON.stringify(date)}; expected a valid date in YYYYMMDD format`,
      {
        code: GtfsErrorCode.INVALID_DATE,
        category: GtfsErrorCategory.VALIDATION,
        details: { value: date },
      },
    );
  }

  const weekday = DAYS_OF_WEEK.at(dateObj.getUTCDay());
  if (weekday === undefined) {
    throw new RangeError('Date returned an invalid UTC weekday');
  }
  return weekday;
}
