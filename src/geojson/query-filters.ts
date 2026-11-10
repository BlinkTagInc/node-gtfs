import { expressionBuilder, sql, type RawBuilder } from 'kysely';
import type { GtfsDatabase } from '../schema/database.ts';
import type { GtfsGeoJSONFilters } from './types.ts';
import {
  selectMatchingTrips,
  selectStopsForTrips,
} from '../query/trip-selection.ts';
import { createGtfsQueryError } from '../diagnostics/errors.ts';

type Root = 'stops' | 'shapes' | 'routes';

/** Domain selectors select roots; association loading must not reuse these filters. */
export function compileGeoJSONSelectors(
  root: Root,
  options: { readonly routeId?: string; readonly serviceDate?: number },
): readonly RawBuilder<boolean>[] {
  const { routeId, serviceDate } = options;
  if (routeId === undefined && serviceDate === undefined) {
    return [];
  }
  if (root === 'stops') {
    const eb = expressionBuilder<GtfsDatabase, 'stops'>();
    const trips = selectStopsForTrips(options);
    return [
      sql<boolean>`${eb.refTuple('stops.source_id', 'stops.stop_id')} in (${trips})`,
    ];
  }
  if (root === 'shapes') {
    const eb = expressionBuilder<GtfsDatabase, 'shapes'>();
    const trips = selectMatchingTrips(options).select([
      'matching_trip.source_id',
      'matching_trip.shape_id',
    ]);
    return [
      sql<boolean>`${eb.refTuple('shapes.source_id', 'shapes.shape_id')} in (${trips})`,
    ];
  }
  const eb = expressionBuilder<GtfsDatabase, 'routes'>();
  const predicates: RawBuilder<boolean>[] = [];
  if (routeId !== undefined) {
    predicates.push(sql<boolean>`${eb('routes.route_id', '=', routeId)}`);
  }
  if (serviceDate !== undefined) {
    const trips = selectMatchingTrips(options).select([
      'matching_trip.source_id',
      'matching_trip.route_id',
    ]);
    predicates.push(
      sql<boolean>`${eb.refTuple('routes.source_id', 'routes.route_id')} in (${trips})`,
    );
  }
  return predicates;
}

export function compileGeoJSONSqlWhere<Table extends Root>(
  callback: GtfsGeoJSONFilters<Table>['sqlWhere'],
): readonly RawBuilder<boolean>[] {
  if (callback === undefined) {
    return [];
  }
  const expression = callback(expressionBuilder<GtfsDatabase, Table>());
  if (
    expression === null ||
    typeof expression !== 'object' ||
    typeof expression.toOperationNode !== 'function'
  ) {
    throw createGtfsQueryError(
      'sqlWhere must return a Kysely boolean expression',
    );
  }
  const node = expression.toOperationNode();
  if (node.kind.endsWith('QueryNode')) {
    throw createGtfsQueryError(
      'sqlWhere must return a boolean expression, not a query builder',
    );
  }
  // Keep raw OR expressions inside this predicate, outside the source constraint.
  return [sql<boolean>`(${expression})`];
}
