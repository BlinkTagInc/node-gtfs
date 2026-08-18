import { compact, omit, pick } from 'lodash-es';
import { FeatureCollection } from 'geojson';
import { featureCollection } from '@turf/helpers';

import type { Shape } from '../../schema/row-types.ts';
import type {
  DynamicQuery,
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { selectRows } from '../sqlite-query.ts';
import { formatWhereConditions } from '../sql-clauses.ts';
import { shapesToGeoJSONFeature } from '../geojson-utils.ts';
import { getAgencies } from './agencies.ts';
import { getRoutes } from './routes.ts';
import { getRouteAttributes } from '../gtfs-plus/route-attributes.ts';
import { shapeIdsForTrips } from './subqueries.ts';

/**
 * Returns array of shapes that match the query parameters. A `route_id` query
 * parameter may be passed to find all shapes for a route. A `trip_id` query
 * parameter may be passed to find all shapes for a trip. A `direction_id`
 * query parameter may be passed to find all shapes for a direction.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getShapes<Fields extends keyof Shape>(
  query: RowQuery<
    Shape & {
      route_id: string | null;
      trip_id: string | null;
      service_id: string | null;
      direction_id: number | null;
    }
  > = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Shape> = [],
  options: SqliteQueryOptions = {},
) {
  const tableName = 'shapes';
  const tripKeys = ['route_id', 'trip_id', 'service_id', 'direction_id'];
  const where = formatWhereConditions(
    omit(query, tripKeys) as DynamicQuery,
    tableName,
  );
  const tripQuery = pick(query, tripKeys) as DynamicQuery;

  if (Object.values(tripQuery).length > 0) {
    const shapeIds = shapeIdsForTrips(tripQuery);
    where.push({
      clause: `shape_id IN (${shapeIds.clause})`,
      params: shapeIds.params,
    });
  }

  return selectRows<Shape, Fields>(
    tableName,
    { fields, where, orderBy },
    options,
  );
}

/**
 * Returns geoJSON of the shapes that match the query parameters. A `route_id`
 * query parameter may be passed to find all shapes for a route. A `trip_id`
 * query parameter may be passed to find all shapes for a trip. A
 * `direction_id` query parameter may be passed to find all shapes for a
 * direction.
 * @param query Column values to match, as single values or arrays
 * @param options Query options, including the database to read from
 * @returns A GeoJSON FeatureCollection with one feature per route, carrying
 *          the route's attributes and agency name. Routes with no shapes are
 *          omitted
 */
export function getShapesAsGeoJSON(
  query: RowQuery<
    Shape & {
      route_id: string | null;
      trip_id: string | null;
      service_id: string | null;
      direction_id: number | null;
    }
  > = {},
  options: SqliteQueryOptions = {},
): FeatureCollection {
  const agencies = getAgencies({}, [], [], options);
  const routeQuery = pick(query, ['route_id']);
  const routes = getRoutes(routeQuery, [], [], options);
  const features = compact(
    routes.map((route) => {
      const shapeQuery = {
        route_id: route.route_id,
        ...omit(query, 'route_id'),
      };
      const shapes = getShapes(shapeQuery, [], [], options);

      if (shapes.length === 0) {
        return;
      }

      const routeAttributes = getRouteAttributes(
        { route_id: route.route_id },
        [],
        [],
        options,
      );

      const agency = agencies.find(
        (agency) => agency.agency_id === route.agency_id,
      );

      const geojsonProperties = {
        agency_name: agency ? agency.agency_name : undefined,
        shape_id: query.shape_id,
        ...route,
        ...(routeAttributes?.[0] || []),
      };
      return shapesToGeoJSONFeature(shapes, geojsonProperties);
    }),
  );

  return featureCollection(features);
}
