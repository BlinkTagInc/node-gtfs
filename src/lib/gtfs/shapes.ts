import { compact, omit, pick } from 'lodash-es';
import { FeatureCollection } from 'geojson';
import { featureCollection } from '@turf/helpers';

import type { Shape } from '../../schema/row-types.ts';
import type {
  DynamicQuery,
  RowOrderBy,
  RowQuery,
  SelectedRow,
  SqliteQueryOptions,
} from '../../types/query.ts';
import type { SqlClause } from '../sql-types.ts';
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

function buildTripSubquery(query: {
  [key: string]: string | number;
}): SqlClause {
  const { clause: whereClause, params } = formatWhereClauses(
    query as DynamicQuery,
  );
  return {
    clause: `SELECT DISTINCT shape_id FROM trips ${whereClause}`,
    params,
  };
}

/*
 * Returns array of shapes that match the query parameters. A `route_id` query
 * parameter may be passed to find all shapes for a route. A `trip_id` query
 * parameter may be passed to find all shapes for a trip. A `direction_id`
 * query parameter may be passed to find all shapes for a direction.
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
    const tripSubquery = buildTripSubquery(tripQuery);
    whereClauses.push({
      clause: `shape_id IN (${tripSubquery.clause})`,
      params: tripSubquery.params,
    });
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.map(({ clause }) => clause).join(' AND ')}`;
  }

  return db
    .prepare(
      `${selectClause} FROM ${tableName} ${whereClause} ${orderByClause};`,
    )
    .all(...whereClauses.flatMap(({ params }) => params)) as SelectedRow<
    Shape,
    Fields
  >[];
}

/*
 * Returns geoJSON of the shapes that match the query parameters. A `route_id`
 * query parameter may be passed to find all shapes for a route. A `trip_id`
 * query parameter may be passed to find all shapes for a trip. A
 * `direction_id` query parameter may be passed to find all shapes for a direction.
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
