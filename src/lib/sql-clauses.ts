import type {
  AdvancedQueryJoin,
  DynamicQuery,
  QueryScalar,
  SortDirection,
} from '../types/query.ts';
import {
  getColumnStorageKinds,
  type ColumnStorageKinds,
} from '../schema/table-registry.ts';
import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from './errors.ts';

/** A value accepted by better-sqlite3 as a statement parameter. */
export type SqliteBindValue = null | string | number | bigint | Uint8Array;

/** SQL text paired with values ordered for its `?` placeholders. */
export interface SqlClause {
  clause: string;
  params: SqliteBindValue[];
}

/** Quotes qualified SQL identifiers while preserving wildcards. */
export function escapeIdentifier(identifier: string) {
  return String(identifier)
    .split('.')
    .map((part) => (part === '*' ? part : `"${part.replaceAll('"', '""')}"`))
    .join('.');
}

function resolveColumnStorageKind(
  key: string,
  table: string | undefined,
): ColumnStorageKinds[string] | undefined {
  const separatorIndex = key.lastIndexOf('.');

  if (separatorIndex === -1) {
    return table === undefined
      ? undefined
      : getColumnStorageKinds(table)?.[key];
  }

  return getColumnStorageKinds(key.slice(0, separatorIndex))?.[
    key.slice(separatorIndex + 1)
  ];
}

/** Converts a query value to a better-sqlite3 bind value. */
function toBindValue(
  value: QueryScalar,
  storageKind?: ColumnStorageKinds[string],
): SqliteBindValue {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  // SQLite does not apply text affinity to a bound parameter, so a number
  // queried against a text column would never match the stored text value.
  if (
    storageKind === 'text' &&
    (typeof value === 'number' || typeof value === 'bigint')
  ) {
    return String(value);
  }

  return value;
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
 * Creates a bare condition matching stops inside a geographic bounding box
 * @param latitudeDegree Center latitude in degrees
 * @param longitudeDegree Center longitude in degrees
 * @param boundingBoxSideMeters Size of bounding box in meters
 * @returns Bounding box condition and its bound parameters, without a leading
 *          `WHERE`
 */
export function formatBoundingBoxCondition(
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
 * Formats a bare condition for a single key-value pair
 * @param key Column name
 * @param value Single value, array of values, or null
 * @param table Table the column belongs to, used to match value types to
 *              column types
 * @returns Condition and its bound parameters, without a leading `WHERE`
 */
export function formatWhereCondition(
  key: string,
  value: QueryScalar | readonly QueryScalar[],
  table?: string,
): SqlClause {
  const escapedKey = escapeIdentifier(key);
  const storageKind = resolveColumnStorageKind(key, table);

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

    return { clause, params: values.map((v) => toBindValue(v, storageKind)) };
  }

  if (value === null || value === undefined) {
    return { clause: `${escapedKey} IS NULL`, params: [] };
  }

  return {
    clause: `${escapedKey} = ?`,
    params: [toBindValue(value as QueryScalar, storageKind)],
  };
}

/**
 * Formats every entry of a query object as a bare condition, without the
 * leading `WHERE`, so that callers can append conditions of their own
 * @param query Object containing column-value pairs
 * @param table Table the columns belong to, used to match value types to
 *              column types
 * @returns One condition per query entry
 */
export function formatWhereConditions(
  query: DynamicQuery,
  table?: string,
): SqlClause[] {
  return Object.entries(query).map(([key, value]) =>
    formatWhereCondition(key, value, table),
  );
}

/**
 * Joins bare conditions with `AND` behind a leading `WHERE`
 * @param conditions Conditions to combine
 * @returns Formatted WHERE clause and its bound parameters, or an empty clause
 *          if there are no conditions
 */
export function combineWhereClauses(
  conditions: readonly SqlClause[],
): SqlClause {
  if (conditions.length === 0) {
    return { clause: '', params: [] };
  }

  return {
    clause: `WHERE ${conditions.map(({ clause }) => clause).join(' AND ')}`,
    params: conditions.flatMap(({ params }) => params),
  };
}

/**
 * Formats complete SQL WHERE clause from query object
 * @param query Object containing column-value pairs
 * @param table Table the columns belong to, used to match value types to
 *              column types
 * @returns Formatted WHERE clause and its bound parameters, or an empty clause
 *          if there are no conditions
 */
export function formatWhereClauses(
  query: DynamicQuery,
  table?: string,
): SqlClause {
  return combineWhereClauses(formatWhereConditions(query, table));
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
