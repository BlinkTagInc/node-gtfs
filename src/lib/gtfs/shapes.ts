import { compact, omit, pick } from 'lodash-es';
import { FeatureCollection } from 'geojson';
import { featureCollection } from '@turf/helpers';

import type {
  QueryOptions,
  Shape,
  SqlOrderBy,
  QueryResult,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { openDb } from '../db.ts';
import {
  formatOrderByClause,
  formatSelectClause,
  formatWhereClause,
  formatWhereClauses,
} from '../utils.ts';
import { shapesToGeoJSONFeature } from '../geojson-utils.ts';
import { getAgencies } from './agencies.ts';
import { getRoutes } from './routes.ts';
import { getRouteAttributes } from '../gtfs-plus/route-attributes.ts';

function buildTripSubquery(query: { [key: string]: string | number }) {
  const whereClause = formatWhereClauses(query);
  return `SELECT DISTINCT shape_id FROM trips ${whereClause}`;
}

/*
 * Returns array of shapes that match the query parameters. A `route_id` query
 * parameter may be passed to find all shapes for a route. A `trip_id` query
 * parameter may be passed to find all shapes for a trip. A `direction_id`
 * query parameter may be passed to find all shapes for a direction.
 */
export function getShapes<Fields extends keyof Shape>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  const db = options.db ?? openDb();
  const tableName = 'shapes';
  const selectClause = formatSelectClause(fields);
  let whereClause = '';
  const orderByClause = formatOrderByClause(orderBy);

  const shapeQuery = omit(query, [
    'route_id',
    'trip_id',
    'service_id',
    'direction_id',
  ]);
  const tripQuery = pick(query, [
    'route_id',
    'trip_id',
    'service_id',
    'direction_id',
  ]) as {
    route_id?: string;
    trip_id?: string;
    service_id?: string;
    direction_id?: number;
  };

  const whereClauses = Object.entries(shapeQuery).map(([key, value]) =>
    formatWhereClause(key, value),
  );

  if (Object.values(tripQuery).length > 0) {
    whereClauses.push(`shape_id IN (${buildTripSubquery(tripQuery)})`);
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.join(' AND ')}`;
  }

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all() as QueryResult<Shape, Fields>[];
}

/*
 * Returns geoJSON of the shapes that match the query parameters. A `route_id`
 * query parameter may be passed to find all shapes for a route. A `trip_id`
 * query parameter may be passed to find all shapes for a trip. A
 * `direction_id` query parameter may be passed to find all shapes for a direction.
 */
export function getShapesAsGeoJSON(
  query: SqlWhere = {},
  options: QueryOptions = {},
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
      const shapes = getShapes(
        shapeQuery,
        ['shape_id', 'shape_pt_sequence', 'shape_pt_lon', 'shape_pt_lat'],
        [],
        options,
      );

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
