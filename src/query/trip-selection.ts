import { expressionBuilder } from 'kysely';
import type { GtfsDatabase } from '../schema/database.ts';
import { compileActiveServiceCondition } from './semantic-filters.ts';

/** Keep route and service qualification on the same trip. */
export function selectMatchingTrips(options: {
  readonly routeId?: string;
  readonly serviceDate?: number;
}) {
  const eb = expressionBuilder<GtfsDatabase>();
  let trips = eb.selectFrom('trips as matching_trip');
  if (options.routeId !== undefined) {
    trips = trips.where('matching_trip.route_id', '=', options.routeId);
  }
  if (options.serviceDate !== undefined) {
    trips = trips.where(
      compileActiveServiceCondition('matching_trip', options.serviceDate),
    );
  }
  return trips;
}

/** ID-set membership avoids rescanning trips separately for every candidate stop. */
export function selectStopsForTrips(options: {
  readonly routeId?: string;
  readonly serviceDate?: number;
}) {
  return selectMatchingTrips(options)
    .innerJoin('stop_times as serving_time', (join) =>
      join
        .onRef('serving_time.source_id', '=', 'matching_trip.source_id')
        .onRef('serving_time.trip_id', '=', 'matching_trip.trip_id'),
    )
    .select(['serving_time.source_id', 'serving_time.stop_id']);
}
