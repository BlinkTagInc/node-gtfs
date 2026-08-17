import Long from 'long';
import type { ReportingOptions } from '../reporting/types.ts';
import type {
  AdvancedQueryJoin,
  DynamicQuery,
  QueryScalar,
  SortDirection,
} from '../types/query.ts';
import type { SqlClause, SqliteBindValue } from './sql-types.ts';
import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from './errors.ts';

/** Quotes qualified SQL identifiers while preserving wildcards. */
export function escapeIdentifier(identifier: string) {
  return String(identifier)
    .split('.')
    .map((part) => (part === '*' ? part : `"${part.replaceAll('"', '""')}"`))
    .join('.');
}

/** Converts a query value to a better-sqlite3 bind value. */
function toBindValue(value: QueryScalar): SqliteBindValue {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  return value;
}

type ConfigWithDefaults<Config, Defaults> = Omit<Config, keyof Defaults> & {
  [Key in keyof Defaults]:
    | Defaults[Key]
    | (Key extends keyof Config ? Exclude<Config[Key], undefined> : never);
};

export function applyConfigDefaults<
  Config extends ReportingOptions,
  Defaults extends object,
>(
  initialConfig: Config,
  defaults: Defaults,
): ConfigWithDefaults<Config, Defaults> {
  const definedConfig = Object.fromEntries(
    Object.entries(initialConfig).filter(([, value]) => value !== undefined),
  );

  return { ...defaults, ...definedConfig } as ConfigWithDefaults<
    Config,
    Defaults
  >;
}

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
 * Formats SQL SELECT clause from array of field names or field mapping object
 * @param fields Array of field names or object mapping source to alias
 * @returns Formatted SELECT clause
 */
export function formatSelectClause(fields: readonly string[]) {
  const selectItem =
    fields.length > 0
      ? fields.map((fieldName) => escapeIdentifier(fieldName)).join(', ')
      : '*';
  return `SELECT ${selectItem}`;
}

/**
 * Formats SQL JOIN clause from array of join configurations
 * @param joinObject Array of join options
 * @returns Formatted JOIN clause
 */
export function formatJoinClause(joinObject: readonly AdvancedQueryJoin[]) {
  return joinObject
    .map((data) => {
      const type = data.type ?? 'INNER';
      if (!['INNER', 'LEFT', 'LEFT OUTER', 'CROSS'].includes(type)) {
        throw new GtfsError(`Unsupported SQL join type "${type}"`, {
          code: GtfsErrorCode.GTFS_QUERY_INVALID,
          category: GtfsErrorCategory.QUERY,
          details: { joinType: type },
        });
      }

      return `${type} JOIN ${escapeIdentifier(data.table)} ON ${data.on}`;
    })
    .join(' ');
}

/**
 * Converts degrees to radians
 * @param angle Angle in degrees
 * @returns Angle in radians
 */
function degree2radian(angle: number) {
  return (angle * Math.PI) / 180;
}

/**
 * Converts radians to degrees
 * @param angle Angle in radians
 * @returns Angle in degrees
 */
function radian2degree(angle: number) {
  return (angle / Math.PI) * 180;
}

const EARTH_RADIUS_METERS = 6371000;

/**
 * Creates SQL WHERE clause for geographic bounding box search
 * @param latitudeDegree Center latitude in degrees
 * @param longitudeDegree Center longitude in degrees
 * @param boundingBoxSideMeters Size of bounding box in meters
 * @returns SQL WHERE clause for bounding box search and its bound parameters
 */
export function formatWhereClauseBoundingBox(
  latitudeDegree: number | string,
  longitudeDegree: number | string,
  boundingBoxSideMeters: number,
): SqlClause {
  const lat = Number(latitudeDegree);
  const lon = Number(longitudeDegree);

  if (
    isNaN(lat) ||
    isNaN(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    throw new GtfsError('Invalid latitude or longitude values', {
      code: GtfsErrorCode.GTFS_QUERY_INVALID,
      category: GtfsErrorCategory.QUERY,
      details: { latitudeDegree, longitudeDegree, boundingBoxSideMeters },
    });
  }

  const latitudeRadian = degree2radian(lat);
  const radiusFromLatitude = Math.cos(latitudeRadian) * EARTH_RADIUS_METERS;

  const halfSide = boundingBoxSideMeters / 2;
  const deltaLatitude = radian2degree(halfSide / EARTH_RADIUS_METERS);
  const deltaLongitude = radian2degree(halfSide / radiusFromLatitude);

  return {
    clause: 'stop_lat BETWEEN ? AND ? AND stop_lon BETWEEN ? AND ?',
    params: [
      lat - deltaLatitude,
      lat + deltaLatitude,
      lon - deltaLongitude,
      lon + deltaLongitude,
    ],
  };
}

/**
 * Formats SQL WHERE clause for a single key-value pair
 * @param key Column name
 * @param value Single value, array of values, or null
 * @returns Formatted WHERE clause condition and its bound parameters
 */
export function formatWhereClause(
  key: string,
  value: QueryScalar | readonly QueryScalar[],
): SqlClause {
  const escapedKey = escapeIdentifier(key);

  if (Array.isArray(value)) {
    const arrayValue = value as readonly QueryScalar[];
    if (arrayValue.length === 0) {
      return { clause: '0 = 1', params: [] };
    }

    const values = arrayValue.filter(
      (v): v is Exclude<QueryScalar, null | undefined> =>
        v !== null && v !== undefined,
    );
    const includesNull = values.length !== arrayValue.length;

    if (values.length === 0) {
      return { clause: `${escapedKey} IS NULL`, params: [] };
    }

    let clause = `${escapedKey} IN (${values.map(() => '?').join(', ')})`;

    if (includesNull) {
      clause = `(${clause} OR ${escapedKey} IS NULL)`;
    }

    return { clause, params: values.map((v) => toBindValue(v)) };
  }

  if (value === null || value === undefined) {
    return { clause: `${escapedKey} IS NULL`, params: [] };
  }

  return {
    clause: `${escapedKey} = ?`,
    params: [toBindValue(value as QueryScalar)],
  };
}

/**
 * Formats complete SQL WHERE clause from query object
 * @param query Object containing column-value pairs
 * @returns Formatted WHERE clause and its bound parameters, or an empty clause
 *          if there are no conditions
 */
export function formatWhereClauses(query: DynamicQuery): SqlClause {
  if (Object.keys(query).length === 0) {
    return { clause: '', params: [] };
  }

  const whereClauses = Object.entries(query).map(([key, value]) =>
    formatWhereClause(key, value),
  );

  return {
    clause: `WHERE ${whereClauses.map(({ clause }) => clause).join(' AND ')}`,
    params: whereClauses.flatMap(({ params }) => params),
  };
}

/**
 * Formats SQL ORDER BY clause from array of sorting criteria
 * @param orderBy Array of [column, direction] tuples
 * @returns Formatted ORDER BY clause
 */
export function formatOrderByClause(
  orderBy: readonly (readonly [string, SortDirection])[],
) {
  let orderByClause = '';

  if (orderBy.length > 0) {
    orderByClause += 'ORDER BY ';

    orderByClause += orderBy
      .map(([key, value]) => {
        const direction = value === 'DESC' ? 'DESC' : 'ASC';
        return `${escapeIdentifier(key)} ${direction}`;
      })
      .join(', ');
  }

  return orderByClause;
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

/**
 * Formats a numeric value according to the decimal precision rules of the specified currency,
 * without any currency symbols or separators.
 * @param value The numeric value to format (e.g., 10.5)
 * @param currency The ISO 4217 currency code (e.g., 'USD', 'JPY', 'EUR')
 * @returns The formatted string with appropriate decimal places
 *          Examples:
 *          - formatCurrency(10.5, 'USD') => '10.50'    // USD uses 2 decimal places
 *          - formatCurrency(10.5, 'JPY') => '10'       // JPY uses 0 decimal places
 *          - formatCurrency(10.523, 'BHD') => '10.523' // BHD uses 3 decimal places
 */
export function formatCurrency(value: number, currency: string) {
  const parts = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).formatToParts(value);

  const integerPart =
    parts.find((part) => part.type === 'integer')?.value ?? '0';
  const fractionPart =
    parts.find((part) => part.type === 'fraction')?.value ?? '';

  return `${integerPart}${fractionPart !== '' ? `.${fractionPart}` : ''}`;
}

/**
 * Applies a prefix to a value if the column should be prefixed and the value is not null
 * @param value The value to prefix
 * @param columnShouldBePrefixed Whether the column should be prefixed
 * @param prefix The prefix to apply
 * @returns The value with the prefix applied if the column should be prefixed and the value is not null
 */
export function applyPrefixToValue<
  Value extends string | number | null | undefined,
>(
  value: Value,
  columnShouldBePrefixed?: boolean,
  prefix?: string,
): Value | string {
  if (
    !columnShouldBePrefixed ||
    prefix === undefined ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  return `${prefix}${value}`;
}

/**
 * Runs an async callback for each item in an array one at a time, in order
 * @param items Items to iterate over
 * @param callback Async function called with each item in turn
 * @returns Array of results in the same order as `items`
 */
export async function mapSeries<Item, Result>(
  items: readonly Item[],
  callback: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  const results: Result[] = [];

  for (const item of items) {
    results.push(await callback(item));
  }

  return results;
}
