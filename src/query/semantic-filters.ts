import { type RawBuilder, sql } from 'kysely';

import { createGtfsQueryError } from '../diagnostics/errors.ts';
import {
  type DynamicRepositoryWhere,
  type RepositoryFilterCompileContext,
  registerRelatedTable,
  requireFilterObject,
} from './filter-context.ts';
import { getServiceDateWeekday } from '../values/service-time.ts';
import { compileNullSafeKeyMembership } from './key-membership.ts';

function requireSingleFilterValue({
  tableName,
  fieldName,
  value,
  expectedType,
}: {
  tableName: string;
  fieldName: string;
  value: unknown;
  expectedType: 'number' | 'string';
}): number | string {
  if (Array.isArray(value) || typeof value !== expectedType) {
    throw createGtfsQueryError(
      `\`${fieldName}\` must be a ${expectedType} for the ${tableName} repository`,
      { table: tableName, field: fieldName, value },
    );
  }
  return value as number | string;
}

function compileActiveServiceSource(
  outerTable: string,
  serviceDateValue: unknown,
): { from: RawBuilder<unknown>; where: RawBuilder<boolean> } {
  const serviceDate = requireSingleFilterValue({
    tableName: 'trips',
    fieldName: 'serviceDate',
    value: serviceDateValue,
    expectedType: 'number',
  });
  let dayOfWeek: string;
  try {
    dayOfWeek = getServiceDateWeekday(serviceDate as number);
  } catch (error) {
    throw createGtfsQueryError(
      '`serviceDate` must be a valid date in YYYYMMDD format',
      {
        table: outerTable,
        field: 'serviceDate',
        value: serviceDate,
      },
      error,
    );
  }

  return {
    from: sql`(
      select source_id, service_id from calendar
      where start_date <= ${serviceDate} and end_date >= ${serviceDate}
        and ${sql.ref(`calendar.${dayOfWeek}`)} = 1
      union
      select source_id, service_id from calendar_dates
      where date = ${serviceDate} and exception_type = 1
    ) as active_services`,
    where: sql<boolean>`not exists (
      select 1 from calendar_dates
      where calendar_dates.source_id = active_services.source_id
        and calendar_dates.service_id = active_services.service_id
        and calendar_dates.date = ${serviceDate}
        and calendar_dates.exception_type = 2
    )`,
  };
}

export function compileActiveServiceCondition(
  outerTable: string,
  serviceDateValue: unknown,
): RawBuilder<boolean> {
  return compileNullSafeKeyMembership({
    columns: ['source_id', 'service_id'].map((field) => ({
      source: sql.ref(`${outerTable}.${field}`),
      target: sql.ref(`active_services.${field}`),
    })),
    ...compileActiveServiceSource(outerTable, serviceDateValue),
  });
}

function compileStopTimeConditions(
  where: DynamicRepositoryWhere,
  outerTable: string,
): RawBuilder<boolean>[] {
  const conditions: RawBuilder<boolean>[] = [];
  if ('serviceDate' in where) {
    const activeServices = compileActiveServiceSource(
      'trips',
      where.serviceDate,
    );
    conditions.push(
      compileNullSafeKeyMembership({
        columns: ['source_id', 'trip_id'].map((field) => ({
          source: sql.ref(`${outerTable}.${field}`),
          target: sql.ref(`trips.${field}`),
        })),
        from: sql`trips inner join (
          select active_services.source_id, active_services.service_id
          from ${activeServices.from}
          where active_services.source_id is not null
            and active_services.service_id is not null
            and ${activeServices.where}
        ) as matching_services
          on trips.source_id = matching_services.source_id
          and trips.service_id = matching_services.service_id`,
        where: sql<boolean>`true`,
      }),
    );
  }
  return conditions;
}

const coordinateBoundsFields = ['south', 'west', 'north', 'east'] as const;

export function compileStopWithinBoundsCondition(
  value: unknown,
  outerTable: string,
): RawBuilder<boolean> {
  const bounds = requireFilterObject(value, {
    tableName: 'stops',
    fieldName: 'withinBounds',
    description: 'a coordinate-bounds object',
  });
  const fields = Object.keys(bounds);
  const unexpectedField = fields.find(
    (field) =>
      !coordinateBoundsFields.includes(
        field as (typeof coordinateBoundsFields)[number],
      ),
  );
  if (unexpectedField !== undefined) {
    throw createGtfsQueryError(
      `Unknown \`withinBounds\` field ${JSON.stringify(unexpectedField)}`,
      {
        table: 'stops',
        field: 'withinBounds',
        boundsField: unexpectedField,
      },
    );
  }

  const coordinates = Object.fromEntries(
    coordinateBoundsFields.map((fieldName) => {
      const coordinate = bounds[fieldName];
      const maximum = fieldName === 'south' || fieldName === 'north' ? 90 : 180;
      if (
        typeof coordinate !== 'number' ||
        !Number.isFinite(coordinate) ||
        coordinate < -maximum ||
        coordinate > maximum
      ) {
        throw createGtfsQueryError(
          `\`withinBounds.${fieldName}\` must be a finite number between ${-maximum} and ${maximum}, inclusive`,
          {
            table: 'stops',
            field: 'withinBounds',
            boundsField: fieldName,
            value: coordinate,
          },
        );
      }
      return [fieldName, coordinate];
    }),
  ) as unknown as Record<(typeof coordinateBoundsFields)[number], number>;

  if (coordinates.south > coordinates.north) {
    throw createGtfsQueryError(
      '`withinBounds.south` must be less than or equal to `withinBounds.north`',
      {
        table: 'stops',
        field: 'withinBounds',
        south: coordinates.south,
        north: coordinates.north,
      },
    );
  }

  const latitude = sql<boolean>`
    ${sql.ref(`${outerTable}.stop_lat`)} >= ${coordinates.south}
    and ${sql.ref(`${outerTable}.stop_lat`)} <= ${coordinates.north}`;
  const longitude =
    coordinates.west <= coordinates.east
      ? sql<boolean>`
          ${sql.ref(`${outerTable}.stop_lon`)} >= ${coordinates.west}
          and ${sql.ref(`${outerTable}.stop_lon`)} <= ${coordinates.east}`
      : sql<boolean>`(
          ${sql.ref(`${outerTable}.stop_lon`)} >= ${coordinates.west}
          or ${sql.ref(`${outerTable}.stop_lon`)} <= ${coordinates.east}
        )`;

  return sql<boolean>`(${latitude} and ${longitude})`;
}

function requireUnixTimestamp(
  fieldName: 'communicationActiveAt' | 'impactActiveAt',
  value: unknown,
): number | bigint {
  const valid =
    !Array.isArray(value) &&
    ((typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) ||
      (typeof value === 'bigint' &&
        value >= 0n &&
        value <= 9_223_372_036_854_775_807n));
  if (!valid) {
    throw createGtfsQueryError(
      `\`${fieldName}\` must be a non-negative Unix timestamp in seconds within the signed 64-bit range`,
      { table: 'alerts', field: fieldName, value },
    );
  }
  return value as number | bigint;
}

function compileAlertPeriodContainsCondition({
  rangeKind,
  fieldName,
  value,
  outerTable,
}: {
  rangeKind: 'communication' | 'impact';
  fieldName: 'communicationActiveAt' | 'impactActiveAt';
  value: unknown;
  outerTable: string;
}): RawBuilder<boolean> {
  const timestamp = requireUnixTimestamp(fieldName, value);
  const comparisonTimestamp = sql`cast(${timestamp} as decimal(20, 0))`;
  const parentMatch = sql<boolean>`
    ${sql.ref('alert_time_ranges.source_id')} = ${sql.ref(`${outerTable}.source_id`)}
    and ${sql.ref('alert_time_ranges.realtime_feed_id')} = ${sql.ref(`${outerTable}.realtime_feed_id`)}
    and ${sql.ref('alert_time_ranges.alert_id')} = ${sql.ref(`${outerTable}.entity_id`)}`;
  const contains = sql<boolean>`
    ${sql.ref('alert_time_ranges.is_valid')} = 1
    and (${sql.ref('alert_time_ranges.start_unix_seconds')} is null
      or ${sql.ref('alert_time_ranges.start_unix_seconds')} <= ${comparisonTimestamp})
    and (${sql.ref('alert_time_ranges.end_unix_seconds')} is null
      or ${sql.ref('alert_time_ranges.end_unix_seconds')} > ${comparisonTimestamp})`;

  return sql<boolean>`(
    exists (
      select 1 from alert_time_ranges
      where ${parentMatch}
        and ${sql.ref('alert_time_ranges.range_kind')} = ${rangeKind}
        and ${contains}
    )
    or (
      not exists (
        select 1 from alert_time_ranges
        where ${parentMatch}
          and ${sql.ref('alert_time_ranges.range_kind')} in ('communication', 'impact')
      )
      and exists (
        select 1 from alert_time_ranges
        where ${parentMatch}
          and ${sql.ref('alert_time_ranges.range_kind')} = 'active'
          and ${contains}
      )
    )
  )`;
}

export function compileSemanticFilters({
  tableName,
  where,
  outerTable,
  context,
}: {
  tableName: string;
  where: DynamicRepositoryWhere;
  outerTable: string;
  context: RepositoryFilterCompileContext;
}): readonly RawBuilder<boolean>[] {
  if (Object.keys(where).length === 0) {
    return [];
  }
  switch (tableName) {
    case 'stops':
      return [compileStopWithinBoundsCondition(where.withinBounds, outerTable)];
    case 'trips':
      registerRelatedTable(context, 'calendar');
      registerRelatedTable(context, 'calendar_dates');
      return [compileActiveServiceCondition(outerTable, where.serviceDate)];
    case 'stop_times':
      if ('serviceDate' in where) {
        registerRelatedTable(context, 'trips');
        registerRelatedTable(context, 'calendar');
        registerRelatedTable(context, 'calendar_dates');
      }
      return compileStopTimeConditions(where, outerTable);
    case 'alerts':
      registerRelatedTable(context, 'alert_time_ranges');
      return Object.entries(where).map(([fieldName, value]) =>
        compileAlertPeriodContainsCondition({
          rangeKind:
            fieldName === 'communicationActiveAt' ? 'communication' : 'impact',
          fieldName: fieldName as 'communicationActiveAt' | 'impactActiveAt',
          value,
          outerTable,
        }),
      );
    default:
      return [];
  }
}
