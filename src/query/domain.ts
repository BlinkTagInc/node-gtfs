import { expressionBuilder, sql, type RawBuilder } from 'kysely';
import type { GtfsDatabase } from '../schema/database.ts';
import { compiledTableRegistry as tables } from '../schema/table-registry.ts';
import type {
  GtfsActiveTripsOptions,
  GtfsDomainQueries,
  GtfsStopsForRouteOptions,
  GtfsStopsQueryOptions,
  GtfsStopTimesQueryOptions,
} from '../types/domain-query.ts';
import { createGtfsQueryError } from '../diagnostics/errors.ts';
import {
  createGtfsReader,
  type RepositoryRuntimeContext,
} from './repository.ts';
import { selectMatchingTrips, selectStopsForTrips } from './trip-selection.ts';
import { isPlainObject } from '../config/options.ts';
import {
  getServiceDateWeekday,
  parseGtfsTimeToServiceDaySeconds,
} from '../values/service-time.ts';
import { compileStopWithinBoundsCondition } from './semantic-filters.ts';

type Context<DB> = Omit<RepositoryRuntimeContext<DB>, 'table' | 'constraints'>;

function options(
  value: unknown,
  keys: readonly string[],
  required: readonly string[] = [],
): void {
  if (!isPlainObject(value)) {
    throw createGtfsQueryError('Query requires a named options object');
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key) || value[key] === undefined) {
      throw createGtfsQueryError(
        `Unknown or undefined query option ${JSON.stringify(key)}`,
      );
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      throw createGtfsQueryError(`Missing query option ${JSON.stringify(key)}`);
    }
  }
  for (const key of ['routeId', 'stopId']) {
    if (
      key in value &&
      (typeof value[key] !== 'string' || value[key].includes('\0'))
    ) {
      throw createGtfsQueryError(
        `${key} must be a string without NUL characters`,
      );
    }
  }
  if (
    'useParentStation' in value &&
    typeof value.useParentStation !== 'boolean'
  ) {
    throw createGtfsQueryError('useParentStation must be a boolean');
  }
  if ('serviceDate' in value) {
    try {
      if (typeof value.serviceDate !== 'number') {
        throw new TypeError('Expected a number');
      }
      getServiceDateWeekday(value.serviceDate);
    } catch (cause) {
      throw createGtfsQueryError(
        'serviceDate must be a valid date in YYYYMMDD format',
        {},
        cause,
      );
    }
  }
}

/** Correlate on source and trip together: GTFS IDs alone are not global keys. */
function routeStopTimes(routeId: string) {
  const eb = expressionBuilder<GtfsDatabase, 'stop_times'>();
  const trips = selectMatchingTrips({ routeId }).select([
    'matching_trip.source_id',
    'matching_trip.trip_id',
  ]);
  return sql<boolean>`${eb.refTuple('stop_times.source_id', 'stop_times.trip_id')} in (${trips})`;
}

function selectedStops(
  value: GtfsStopsQueryOptions & Partial<GtfsStopsForRouteOptions>,
  sourceIds: readonly string[] | null,
): RawBuilder<boolean> {
  const eb = expressionBuilder<GtfsDatabase, 'stops'>();
  let candidates = eb
    .selectFrom('stops as candidate')
    .leftJoin('stops as parent', (join) =>
      join
        .onRef('parent.source_id', '=', 'candidate.source_id')
        .onRef('parent.stop_id', '=', 'candidate.parent_station')
        .on('candidate.parent_station', '!=', ''),
    )
    .leftJoin('stops as station', (join) =>
      join
        .onRef('station.source_id', '=', 'parent.source_id')
        .onRef('station.stop_id', '=', 'parent.parent_station')
        .on('parent.parent_station', '!=', ''),
    );
  if (sourceIds !== null) {
    candidates = candidates.where('candidate.source_id', 'in', sourceIds);
  }
  if (value.withinBounds !== undefined) {
    candidates = candidates.where(
      compileStopWithinBoundsCondition(value.withinBounds, 'candidate'),
    );
  }
  if (value.routeId !== undefined) {
    const stops = selectStopsForTrips(value);
    candidates = candidates.where(
      (e) =>
        sql<boolean>`${e.refTuple('candidate.source_id', 'candidate.stop_id')} in (${stops})`,
    );
  }
  const identities =
    value.useParentStation === true
      ? candidates.select((e) => {
          const parentPosition = e.and([
            e('parent.location_type', '=', 1),
            e('parent.stop_lon', '>=', -180),
            e('parent.stop_lon', '<=', 180),
            e('parent.stop_lat', '>=', -90),
            e('parent.stop_lat', '<=', 90),
          ]);
          const stationPosition = e.and([
            e('station.location_type', '=', 1),
            e('station.stop_lon', '>=', -180),
            e('station.stop_lon', '<=', 180),
            e('station.stop_lat', '>=', -90),
            e('station.stop_lat', '<=', 90),
          ]);
          const resolved = e
            .case()
            .when(
              e.and([
                e('candidate.location_type', '=', 4),
                e.or([
                  e('parent.location_type', 'is', null),
                  e('parent.location_type', '=', 0),
                ]),
                stationPosition,
              ]),
            )
            .then(e.ref('station.stop_id'))
            .when(
              e.and([
                e.or([
                  e('candidate.location_type', 'is', null),
                  e('candidate.location_type', 'in', [0, 2, 3]),
                ]),
                parentPosition,
              ]),
            )
            .then(e.ref('parent.stop_id'))
            .when(
              e.or([
                e('candidate.parent_station', 'is', null),
                e('candidate.parent_station', '=', ''),
              ]),
            )
            .then(e.ref('candidate.stop_id'))
            .else(null)
            .end();
          return ['candidate.source_id', resolved.as('stop_id')];
        })
      : candidates
          .select(['candidate.source_id', 'candidate.stop_id'])
          .where((e) =>
            e.or([
              e('candidate.location_type', 'is', null),
              e('candidate.location_type', '!=', 1),
            ]),
          );
  // Select identities before outer refinement/paging; membership cannot duplicate rows.
  return sql<boolean>`${eb.refTuple('stops.source_id', 'stops.stop_id')} in (${identities})`;
}

export function createGtfsDomainQueries<DB>(
  context: Context<DB>,
): GtfsDomainQueries {
  const stopReader = (
    value: GtfsStopsQueryOptions & Partial<GtfsStopsForRouteOptions>,
  ) =>
    createGtfsReader<'stops', DB>({
      ...context,
      table: tables.stops,
      constraints: {
        where: [selectedStops(value, context.sourceIds)],
        tables: [
          tables.stops,
          ...(value.routeId === undefined
            ? []
            : [tables.trips, tables.stopTimes]),
          ...(value.serviceDate === undefined
            ? []
            : [tables.calendar, tables.calendarDates]),
        ],
      },
    });
  return Object.freeze({
    stops(value: GtfsStopsQueryOptions = {}) {
      options(value, ['withinBounds', 'useParentStation']);
      return stopReader(value);
    },
    stopsForRoute(value: GtfsStopsForRouteOptions) {
      options(
        value,
        ['routeId', 'serviceDate', 'useParentStation'],
        ['routeId'],
      );
      return stopReader(value);
    },
    activeTrips(value: GtfsActiveTripsOptions) {
      options(value, ['serviceDate', 'routeId'], ['serviceDate']);
      return createGtfsReader<'trips', DB>({
        ...context,
        table: tables.trips,
      }).where({
        serviceDate: value.serviceDate,
        ...(value.routeId === undefined ? {} : { route_id: value.routeId }),
      });
    },
    stopTimes(value: GtfsStopTimesQueryOptions) {
      options(
        value,
        ['serviceDate', 'routeId', 'stopId', 'window'],
        ['serviceDate'],
      );
      const where: RawBuilder<boolean>[] = [];
      const requiredColumns = new Map<string, ReadonlySet<string>>();
      if (value.routeId !== undefined) {
        where.push(routeStopTimes(value.routeId));
      }
      if (value.window !== undefined) {
        options(
          value.window,
          ['field', 'start', 'end'],
          ['field', 'start', 'end'],
        );
        const { field, start, end } = value.window;
        const startSeconds = parseGtfsTimeToServiceDaySeconds(start);
        const endSeconds = parseGtfsTimeToServiceDaySeconds(end);
        if (
          (field !== 'arrival_time' && field !== 'departure_time') ||
          startSeconds === null ||
          endSeconds === null ||
          startSeconds > endSeconds
        ) {
          throw createGtfsQueryError(
            'window requires arrival_time or departure_time and valid start <= end GTFS times',
          );
        }
        const column =
          field === 'arrival_time'
            ? 'arrival_service_day_seconds'
            : 'departure_service_day_seconds';
        const eb = expressionBuilder<GtfsDatabase, 'stop_times'>();
        where.push(
          sql<boolean>`${eb.and([eb(column, '>=', startSeconds), eb(column, '<', endSeconds)])}`,
        );
        requiredColumns.set('stop_times', new Set([column]));
      }
      return createGtfsReader<'stop_times', DB>({
        ...context,
        table: tables.stopTimes,
        constraints: { where, tables: [tables.trips], requiredColumns },
      }).where({
        serviceDate: value.serviceDate,
        ...(value.stopId === undefined ? {} : { stop_id: value.stopId }),
      });
    },
  });
}
