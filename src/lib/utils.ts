import sqlString from 'sqlstring-sqlite';
import Long from 'long';
import {
  Config,
  JoinOptions,
  SqlWhere,
  SqlValue,
  SqlOrderBy,
} from '../types/global_interfaces.ts';

/*
 * Validate configuration.
 */
export function validateConfigForImport(config: Config) {
  if (!config.agencies || config.agencies.length === 0) {
    throw new Error('No `agencies` specified in config');
  }

  for (const [index, agency] of config.agencies.entries()) {
    if (!agency.path && !agency.url) {
      throw new Error(
        `No Agency \`url\` or \`path\` specified in config for agency index ${index}.`,
      );
    }
  }

  return config;
}

/*
 * Initialize configuration with defaults.
 */
export function setDefaultConfig(initialConfig: Config) {
  const defaults = {
    sqlitePath: ':memory:',
    ignoreDuplicates: false,
    ignoreErrors: false,
    gtfsRealtimeExpirationSeconds: 0,
  };

  return {
    ...defaults,
    ...initialConfig,
  };
}

export function convertLongTimeToDate(longDate: {
  high: any;
  low: any;
  unsigned: any;
}) {
  const { high, low, unsigned } = longDate;
  return new Date(new Long(low, high, unsigned).toInt() * 1000).toISOString();
}

/*
 * Calculate seconds from midnight for HH:mm:ss
 */
export function calculateSecondsFromMidnight(time: string) {
  const split = time.split(':').map((d) => Number.parseInt(d, 10));
  if (split.length !== 3) {
    return null;
  }

  return split[0] * 3600 + split[1] * 60 + split[2];
}

/*
 * Adds leading zeros to HH:mm:ss timestamps
 */
export function padLeadingZeros(time: string) {
  const split = time.split(':').map((d) => String(Number(d)).padStart(2, '0'));
  if (split.length !== 3) {
    return null;
  }

  return split.join(':');
}

export function formatSelectClause(fields: string[]) {
  if (Array.isArray(fields)) {
    const selectItem =
      fields.length > 0
        ? fields.map((fieldName) => sqlString.escapeId(fieldName)).join(', ')
        : '*';
    return `SELECT ${selectItem}`;
  }

  const selectItem = Object.entries(fields)
    .map(
      (key) => `${sqlString.escapeId(key[0])} AS ${sqlString.escapeId(key[1])}`,
    )
    .join(', ');
  return `SELECT ${selectItem}`;
}

export function formatJoinClause(joinObject: JoinOptions[]) {
  return joinObject
    .map(
      (data) =>
        `${data.type ? data.type + ' JOIN' : 'INNER JOIN'} ${sqlString.escapeId(
          data.table,
        )} ON ${data.on}`,
    )
    .join(' ');
}

function degree2radian(angle: number) {
  return (angle * Math.PI) / 180;
}

function radian2degree(angle: number) {
  return (angle / Math.PI) * 180;
}

/*
 * Search inside GPS coordinates boundary box
 * Distance unit: meters
 * */
export function formatWhereClauseBoundingBox(
  latitudeDegree: string | number,
  longitudeDegree: string | number,
  boundingBoxSideMeters: number,
) {
  const earthRadius = 6371000;
  latitudeDegree =
    typeof latitudeDegree === 'string'
      ? parseFloat(latitudeDegree)
      : latitudeDegree;
  longitudeDegree =
    typeof longitudeDegree === 'string'
      ? parseFloat(longitudeDegree)
      : longitudeDegree;

  const latitudeRadian = degree2radian(latitudeDegree);
  const radiusFromLatitude = Math.cos(latitudeRadian) * earthRadius;

  // `boundingBoxSideMeters` is divided by 2 we are centering the coordinates in the middle of this square
  const deltaLatitude = radian2degree(boundingBoxSideMeters / 2 / earthRadius);
  const deltaLongitude = radian2degree(
    boundingBoxSideMeters / 2 / radiusFromLatitude,
  );

  let query = `stop_lat BETWEEN ${latitudeDegree - deltaLatitude} AND ${latitudeDegree + deltaLatitude}`;
  query += ` AND stop_lon BETWEEN ${longitudeDegree - deltaLongitude} AND ${longitudeDegree + deltaLongitude}`;

  return query;
}

export function formatWhereClause(
  key: string,
  value: null | SqlValue | SqlValue[],
) {
  if (Array.isArray(value)) {
    let whereClause = `${sqlString.escapeId(key)} IN (${value
      .filter((v) => v !== null)
      .map((v) => sqlString.escape(v))
      .join(', ')})`;

    if (value.includes(null)) {
      whereClause = `(${whereClause} OR ${sqlString.escapeId(key)} IS NULL)`;
    }

    return whereClause;
  }

  if (value === null) {
    return `${sqlString.escapeId(key)} IS NULL`;
  }

  return `${sqlString.escapeId(key)} = ${sqlString.escape(value)}`;
}

export function formatWhereClauses(query: SqlWhere) {
  if (Object.keys(query).length === 0) {
    return '';
  }

  const whereClauses = Object.entries(query).map(([key, value]) =>
    formatWhereClause(key, value),
  );
  return `WHERE ${whereClauses.join(' AND ')}`;
}

export function formatOrderByClause(orderBy: SqlOrderBy) {
  let orderByClause = '';

  if (orderBy.length > 0) {
    orderByClause += 'ORDER BY ';

    orderByClause += orderBy
      .map(([key, value]) => {
        const direction = value === 'DESC' ? 'DESC' : 'ASC';
        return `${sqlString.escapeId(key)} ${direction}`;
      })
      .join(', ');
  }

  return orderByClause;
}

export function getDayOfWeekFromDate(date: number) {
  const daysOfWeek = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const dateString = date
    .toString()
    .replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
  const [year, month, day] = dateString.split('-').map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay();
  return daysOfWeek[dayOfWeek];
}
