import type {
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
} from 'geojson';
import type { Kysely } from 'kysely';
import { compact } from 'lodash-es';
import { featureCollection } from '@turf/helpers';

import type { Routes } from '../schema/row-types.ts';
import type { GtfsDatabaseDialect } from '../database/dialects.ts';
import { createGtfsQueryError } from '../diagnostics/errors.ts';
import {
  createRouteGeoJSONFeature,
  createShapeGeoJSONFeature,
  createStopsGeoJSONFeatureCollection,
  omitNullGeoJSONProperties,
} from './features.ts';
import {
  loadRoutesGeoJSONData,
  loadShapesGeoJSONData,
  loadStopsGeoJSONData,
  type ShapesGeoJSONData,
  type RoutesGeoJSONData,
  type StopsGeoJSONData,
} from './data.ts';
import type {
  GtfsGeoJSON,
  GtfsGeoJSONRoutesOptions,
  GtfsGeoJSONShapesOptions,
  GtfsGeoJSONStopsOptions,
  GtfsRouteGeoJSONProperties,
  GtfsShapeGeoJSONProperties,
  GtfsStopGeoJSONProperties,
} from './types.ts';
import type { GtfsExtension } from '../schema/extensions.ts';
import { isPlainObject } from '../config/options.ts';
import { getServiceDateWeekday } from '../values/service-time.ts';
import { assertDefinedWhereValues } from '../query/where-validation.ts';

interface GtfsGeoJSONContext<DB> {
  databaseOperation<Result>(
    callback: (database: Kysely<DB>) => Promise<Result>,
  ): Promise<Result>;
  readonly dialect: GtfsDatabaseDialect;
  readonly enabledExtensions: readonly GtfsExtension[];
  readonly sourceIds: readonly string[] | null;
}

function validateOptions(
  method: 'shapes' | 'stops' | 'routes',
  options: unknown,
): void {
  const methodName = `gtfs.geojson.${method}`;
  if (!isPlainObject(options)) {
    throw createGtfsQueryError(
      `\`${methodName}\` accepts one named options object`,
      {
        table: method,
        method: methodName,
      },
    );
  }
  const unknownOption = Object.keys(options).find(
    (key) =>
      !['where', 'routeId', 'serviceDate', 'sqlWhere'].includes(key) &&
      !(method === 'stops' && key === 'useParentStation'),
  );
  if (unknownOption !== undefined) {
    throw createGtfsQueryError(
      `Unknown \`${methodName}\` option ${JSON.stringify(unknownOption)}`,
      {
        table: method,
        method: methodName,
        option: unknownOption,
      },
    );
  }
  if (
    Object.hasOwn(options, 'useParentStation') &&
    typeof options.useParentStation !== 'boolean'
  ) {
    throw createGtfsQueryError(
      '`gtfs.geojson.stops.useParentStation` must be a boolean',
      { table: method, method: methodName, option: 'useParentStation' },
    );
  }
  if (
    Object.hasOwn(options, 'routeId') &&
    (typeof options.routeId !== 'string' || options.routeId.includes('\0'))
  ) {
    throw createGtfsQueryError(
      'routeId must be a string without NUL characters',
    );
  }
  if (Object.hasOwn(options, 'serviceDate')) {
    try {
      if (typeof options.serviceDate !== 'number') {
        throw new TypeError('Expected a number');
      }
      getServiceDateWeekday(options.serviceDate);
    } catch (cause) {
      throw createGtfsQueryError(
        'serviceDate must be a valid date in YYYYMMDD format',
        {},
        cause,
      );
    }
  }
  if (
    Object.hasOwn(options, 'sqlWhere') &&
    typeof options.sqlWhere !== 'function'
  ) {
    throw createGtfsQueryError(
      'sqlWhere must be a Kysely expression-builder callback',
    );
  }
  if (Object.hasOwn(options, 'where') && options.where === undefined) {
    assertDefinedWhereValues(options.where, method);
  }
  if (options.where !== undefined && !isPlainObject(options.where)) {
    throw createGtfsQueryError(
      `\`${methodName}.where\` must be an equality object; use sqlWhere for SQL predicates`,
      {
        table: method,
        method: methodName,
        option: 'where',
      },
    );
  }
}

function compositeKey(sourceId: string, id: string): string {
  return JSON.stringify([sourceId, id]);
}

function indexCompositeRows<Row extends { source_id: string }>(
  rows: readonly Row[],
  getId: (row: Row) => string,
): Map<string, Row[]> {
  const index = new Map<string, Row[]>();
  for (const row of rows) {
    const key = compositeKey(row.source_id, getId(row));
    const group = index.get(key);
    if (group === undefined) {
      index.set(key, [row]);
    } else {
      group.push(row);
    }
  }
  return index;
}

function createRoutePropertiesIndex(
  data: Pick<ShapesGeoJSONData, 'routes' | 'routeAttributes' | 'agencyRows'>,
) {
  const attributesByRoute = indexCompositeRows(
    data.routeAttributes,
    (row) => row.route_id,
  );
  const agencyBySource = indexCompositeRows(data.agencyRows, () => '');
  const propertiesByRoute = new Map<string, GtfsRouteGeoJSONProperties>();
  for (const route of data.routes) {
    const key = compositeKey(route.source_id, route.route_id);
    const agencies =
      agencyBySource.get(compositeKey(route.source_id, '')) ?? [];
    const agency =
      route.agency_id === null
        ? agencies.length === 1
          ? agencies[0]
          : undefined
        : agencies.find((candidate) => candidate.agency_id === route.agency_id);
    const { route_color, route_text_color, ...row } = {
      ...route,
      ...attributesByRoute.get(key)?.[0],
    };
    propertiesByRoute.set(key, {
      ...omitNullGeoJSONProperties(row),
      ...(agency === undefined ? {} : { agency_name: agency.agency_name }),
      ...(route_color ? { route_color: `#${route_color}` as const } : {}),
      ...(route_text_color
        ? { route_text_color: `#${route_text_color}` as const }
        : {}),
    });
  }
  return propertiesByRoute;
}

function servingRouteProperties(
  associations: readonly Pick<Routes, 'source_id' | 'route_id'>[],
  propertiesByRoute: ReadonlyMap<string, GtfsRouteGeoJSONProperties>,
): GtfsRouteGeoJSONProperties[] {
  const routes = new Map<string, GtfsRouteGeoJSONProperties>();
  for (const association of associations) {
    const key = compositeKey(association.source_id, association.route_id);
    const properties = propertiesByRoute.get(key);
    if (properties !== undefined) {
      routes.set(key, properties);
    }
  }
  return [...routes.values()].sort((left, right) =>
    left.route_id < right.route_id
      ? -1
      : left.route_id > right.route_id
        ? 1
        : 0,
  );
}

function sharedAgencyProperties(
  routes: readonly GtfsRouteGeoJSONProperties[],
): { agency_name?: string } {
  const first = routes[0];
  if (
    first?.agency_name === undefined ||
    routes.some(
      (route) =>
        route.source_id !== first.source_id ||
        route.agency_id !== first.agency_id ||
        route.agency_name !== first.agency_name,
    )
  ) {
    return {};
  }
  return { agency_name: first.agency_name };
}

export function createStopFeatureCollection(
  data: StopsGeoJSONData,
): FeatureCollection<Point, GtfsStopGeoJSONProperties> {
  const routesByStop = indexCompositeRows(
    data.stopRoutes,
    (row) => row.stop_id,
  );
  const attributesByStop = indexCompositeRows(
    data.stopAttributes,
    (row) => row.stop_id,
  );
  const propertiesByRoute = createRoutePropertiesIndex(data);
  const preparedStops = data.stops.map((stop) => {
    const key = compositeKey(stop.source_id, stop.stop_id);
    const routes = servingRouteProperties(
      routesByStop.get(key) ?? [],
      propertiesByRoute,
    );
    return {
      ...stop,
      ...attributesByStop.get(key)?.[0],
      routes,
      ...sharedAgencyProperties(routes),
    };
  });
  return createStopsGeoJSONFeatureCollection(preparedStops);
}

export function createShapeFeatureCollection(
  data: ShapesGeoJSONData,
): FeatureCollection<LineString, GtfsShapeGeoJSONProperties> {
  const shapesById = indexCompositeRows(data.shapes, (row) => row.shape_id);
  const routesByShape = indexCompositeRows(
    data.shapeRoutes,
    (row) => row.shape_id,
  );
  const propertiesByRoute = createRoutePropertiesIndex(data);
  const features = [];
  for (const [key, points] of shapesById) {
    const first = points[0];
    if (first === undefined) {
      continue;
    }
    const routes = servingRouteProperties(
      routesByShape.get(key) ?? [],
      propertiesByRoute,
    );
    const shape = createShapeGeoJSONFeature(points, {
      source_id: first.source_id,
      shape_id: first.shape_id,
      routes,
      ...sharedAgencyProperties(routes),
    });
    if (shape !== undefined) {
      features.push(shape);
    }
  }
  return featureCollection(features);
}

export function createRouteFeatureCollection(
  data: RoutesGeoJSONData,
): FeatureCollection<MultiLineString, GtfsRouteGeoJSONProperties> {
  const shapesById = new Map(
    data.shapes.map((shape) => [
      compositeKey(shape.source_id, shape.shape_id),
      shape,
    ]),
  );
  const shapesByRoute = indexCompositeRows(
    data.shapeRoutes,
    (row) => row.route_id,
  );
  const propertiesByRoute = createRoutePropertiesIndex(data);
  const features = compact(
    data.routes.map((route) => {
      const key = compositeKey(route.source_id, route.route_id);
      const shapeIds = new Set(
        (shapesByRoute.get(key) ?? []).map((row) => row.shape_id),
      );
      const shapeGroups = compact(
        [...shapeIds]
          .sort()
          .map((shapeId) =>
            shapesById.get(compositeKey(route.source_id, shapeId)),
          ),
      );
      const properties = propertiesByRoute.get(key);
      return properties === undefined
        ? undefined
        : createRouteGeoJSONFeature(shapeGroups, properties);
    }),
  );
  return featureCollection(features);
}

export function createGtfsGeoJSON<DB>(
  context: GtfsGeoJSONContext<DB>,
): GtfsGeoJSON {
  return Object.freeze({
    async stops(options: GtfsGeoJSONStopsOptions = {}) {
      validateOptions('stops', options);
      return context.databaseOperation(async (database) =>
        createStopFeatureCollection(
          await loadStopsGeoJSONData({
            ...context,
            ...options,
            database,
            where: options.where ?? {},
            useParentStation: options.useParentStation ?? false,
          }),
        ),
      );
    },
    async shapes(options: GtfsGeoJSONShapesOptions = {}) {
      validateOptions('shapes', options);
      return context.databaseOperation(async (database) =>
        createShapeFeatureCollection(
          await loadShapesGeoJSONData({
            ...context,
            ...options,
            database,
            where: options.where ?? {},
          }),
        ),
      );
    },
    async routes(options: GtfsGeoJSONRoutesOptions = {}) {
      validateOptions('routes', options);
      return context.databaseOperation(async (database) =>
        createRouteFeatureCollection(
          await loadRoutesGeoJSONData({
            ...context,
            ...options,
            database,
            where: options.where ?? {},
          }),
        ),
      );
    },
  });
}
