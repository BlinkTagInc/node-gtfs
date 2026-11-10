import type { Kysely } from 'kysely';
import type { GtfsDatabase } from '../schema/database.ts';

import { compiledTableRegistry } from '../schema/table-registry.ts';
import type { GtfsGeoJSONFilters } from './types.ts';
import {
  compileGeoJSONSelectors,
  compileGeoJSONSqlWhere,
} from './query-filters.ts';
import type {
  Agency,
  RouteAttributes,
  Routes,
  Shapes,
  StopAttributes,
  Stops,
} from '../schema/row-types.ts';
import { asDynamicKysely } from '../database/clients.ts';
import type { GtfsDatabaseDialect } from '../database/dialects.ts';
import { compilePortableQueryPlan } from '../database/kysely/query/plan.ts';
import {
  applyPortableQueryPredicates,
  compilePortableQueryPredicates,
} from '../database/kysely/query/predicates.ts';
import { compilePortableQuerySelection } from '../database/kysely/query/selection.ts';
import { validateGtfsQuerySchema } from '../database/query-schema.ts';
import {
  assertGtfsExtensionEnabled,
  type GtfsExtension,
} from '../schema/extensions.ts';
import { compileRepositoryFilters } from '../query/filters.ts';
import { resolveQueryWhere } from '../query/equality.ts';
import { resolveGeoJSONParentStations } from './parent-stations.ts';
import { createRouteShape, type RouteShape } from './features.ts';

interface GtfsGeoJSONReadContext<DB> {
  readonly database: Kysely<DB>;
  readonly dialect: GtfsDatabaseDialect;
  readonly enabledExtensions: readonly GtfsExtension[];
  readonly sourceIds: readonly string[] | null;
}

interface LoadGtfsGeoJSONDataOptions<
  DB,
  Table extends 'stops' | 'shapes' | 'routes',
>
  extends GtfsGeoJSONReadContext<DB>, GtfsGeoJSONFilters<Table> {}

interface RouteGeoJSONData {
  readonly agencyRows: readonly Agency[];
  readonly routes: readonly Routes[];
  readonly routeAttributes: readonly RouteAttributes[];
}

interface StopRouteAssociation {
  readonly source_id: string;
  readonly stop_id: string;
  readonly route_id: string;
}

interface ShapeRouteAssociation {
  readonly source_id: string;
  readonly shape_id: string;
  readonly route_id: string;
}

export interface StopsGeoJSONData extends RouteGeoJSONData {
  readonly stopAttributes: readonly StopAttributes[];
  readonly stops: readonly Stops[];
  readonly stopRoutes: readonly StopRouteAssociation[];
}

export interface ShapesGeoJSONData extends RouteGeoJSONData {
  readonly shapes: readonly Shapes[];
  readonly shapeRoutes: readonly ShapeRouteAssociation[];
}

export interface RoutesGeoJSONData extends RouteGeoJSONData {
  readonly shapes: readonly RouteShape[];
  readonly shapeRoutes: readonly ShapeRouteAssociation[];
}

interface GeoJSONRows {
  agency: Agency;
  routeAttributes: RouteAttributes;
  routes: Routes;
  shapes: Shapes;
  stopAttributes: StopAttributes;
  stops: Stops;
}

// Stay below SQLite's 500-term compound SELECT and 999-variable limits.
const GEOJSON_ID_BATCH_SIZE = 400;
// Shape IDs can expand to thousands of point rows. Compact smaller batches
// before loading the next one so route geometry does not retain all those rows.
const ROUTE_SHAPE_BATCH_SIZE = 32;

async function readSourceScopedBatches<
  Identity extends { readonly source_id: string },
  Row,
>(
  identities: readonly Identity[],
  getId: (identity: Identity) => string,
  read: (sourceId: string, ids: readonly string[]) => Promise<Row[]>,
  batchSize = GEOJSON_ID_BATCH_SIZE,
): Promise<Row[]> {
  const idsBySource = new Map<string, Set<string>>();
  for (const identity of identities) {
    let ids = idsBySource.get(identity.source_id);
    if (ids === undefined) {
      ids = new Set();
      idsBySource.set(identity.source_id, ids);
    }
    ids.add(getId(identity));
  }
  const rows: Row[] = [];
  for (const [sourceId, sourceIds] of idsBySource) {
    const ids = [...sourceIds];
    for (let offset = 0; offset < ids.length; offset += batchSize) {
      const batch = await read(sourceId, ids.slice(offset, offset + batchSize));
      for (const row of batch) {
        rows.push(row);
      }
    }
  }
  return rows;
}

async function createGeoJSONReader<
  DB,
  Root extends 'stops' | 'shapes' | 'routes',
>(
  context: GtfsGeoJSONReadContext<DB>,
  root: Root,
  options: GtfsGeoJSONFilters<Root>,
) {
  const table = compiledTableRegistry[root];
  const filters = compileRepositoryFilters({
    dialect: context.dialect,
    table,
    where: resolveQueryWhere(table, options.where ?? {}),
  });
  const additionalWhere = [
    ...filters.additionalWhere,
    ...compileGeoJSONSelectors(root, options),
    ...compileGeoJSONSqlWhere(options.sqlWhere),
  ];
  const predicates = compilePortableQueryPredicates({
    context: { ...context, table, additionalWhere },
    where: undefined,
  });
  const includeAttributes = context.enabledExtensions.includes('gtfs-plus');
  const tables = [
    table,
    compiledTableRegistry.agency,
    compiledTableRegistry.routes,
    compiledTableRegistry.trips,
    ...filters.relatedTables,
    ...(options.serviceDate === undefined
      ? []
      : [compiledTableRegistry.calendar, compiledTableRegistry.calendarDates]),
    ...(root === 'stops'
      ? [compiledTableRegistry.stopTimes]
      : [compiledTableRegistry.shapes]),
    ...(includeAttributes
      ? [
          compiledTableRegistry.routeAttributes,
          ...(root === 'stops' ? [compiledTableRegistry.stopAttributes] : []),
        ]
      : []),
  ];
  for (const requiredTable of tables) {
    assertGtfsExtensionEnabled(
      requiredTable.tableName,
      requiredTable.specification,
      context.enabledExtensions,
    );
  }
  await validateGtfsQuerySchema({
    database: context.database,
    dialect: context.dialect,
    tables,
    requiredColumns: filters.requiredColumns,
  });

  // The preflight above establishes the managed GTFS tables even when the
  // caller's advanced database type describes additional or fewer tables.
  const database = context.database as unknown as Kysely<GtfsDatabase>;
  const select = <Table extends keyof GeoJSONRows>(key: Table) => {
    const definition = compiledTableRegistry[key];
    const plan = compilePortableQueryPlan(definition, {});
    const selection = compilePortableQuerySelection(
      context.dialect,
      plan.selectedFields,
    );
    // Select manifest public fields, never storage-only columns from SELECT *.
    return asDynamicKysely(database)
      .selectFrom(definition.tableName)
      .select(selection.expressions)
      .$castTo<GeoJSONRows[Table]>();
  };
  const loadRouteDetails = async (routes: readonly Routes[]) => {
    const sourceIds = [...new Set(routes.map((route) => route.source_id))];
    const agencyRows: Agency[] = [];
    for (
      let offset = 0;
      offset < sourceIds.length;
      offset += GEOJSON_ID_BATCH_SIZE
    ) {
      const batch = await select('agency')
        .where(
          'source_id',
          'in',
          sourceIds.slice(offset, offset + GEOJSON_ID_BATCH_SIZE),
        )
        .execute();
      for (const agency of batch) {
        agencyRows.push(agency);
      }
    }
    const routeAttributes = includeAttributes
      ? await readSourceScopedBatches(
          routes,
          (route) => route.route_id,
          (sourceId, ids) =>
            select('routeAttributes')
              .where('source_id', '=', sourceId)
              .where('route_id', 'in', ids)
              .execute(),
        )
      : [];
    return { agencyRows, routeAttributes };
  };
  return {
    database,
    predicates,
    hasRootFilter: additionalWhere.length > 0,
    includeAttributes,
    select,
    loadRouteDetails,
  };
}

export async function loadStopsGeoJSONData<DB>(
  options: LoadGtfsGeoJSONDataOptions<DB, 'stops'> & {
    readonly useParentStation?: boolean;
  },
): Promise<StopsGeoJSONData> {
  const { useParentStation = false, ...context } = options;
  const reader = await createGeoJSONReader(context, 'stops', options);
  const { database, select } = reader;
  // Evaluate the user's filter once, not inside each association and metadata query.
  const selectedStops = await applyPortableQueryPredicates(
    select('stops'),
    reader.predicates,
  )
    .orderBy('source_id')
    .orderBy('stop_id')
    .execute();
  const stops = useParentStation
    ? await resolveGeoJSONParentStations({
        stops: selectedStops,
        readStops: (identities) =>
          readSourceScopedBatches(
            identities,
            (stop) => stop.stop_id,
            (sourceId, ids) =>
              select('stops')
                .where('source_id', '=', sourceId)
                .where('stop_id', 'in', ids)
                .execute(),
          ),
      })
    : selectedStops.filter((stop) => stop.location_type !== 1);
  const associations = database
    .selectFrom('stop_times')
    .innerJoin('trips', (join) =>
      join
        .onRef('trips.source_id', '=', 'stop_times.source_id')
        .onRef('trips.trip_id', '=', 'stop_times.trip_id'),
    )
    .select(['stop_times.source_id', 'stop_times.stop_id', 'trips.route_id'])
    .distinct()
    .$castTo<StopRouteAssociation>();
  const readFilteredAssociations = (
    identities: readonly Pick<Stops, 'source_id' | 'stop_id'>[],
  ) =>
    readSourceScopedBatches(
      identities,
      (stop) => stop.stop_id,
      (sourceId, ids) => {
        const [firstId, ...remainingIds] = ids;
        if (firstId === undefined) {
          return Promise.resolve([]);
        }
        const sourceAssociations = associations.where(
          'stop_times.source_id',
          '=',
          sourceId,
        );
        // Per-stop equality lookups avoid source-wide scans when sampled statistics
        // underestimate rows per source. IDs are unique within each bounded batch.
        return sourceAssociations
          .where('stop_times.stop_id', '=', firstId)
          .unionAll(
            remainingIds.map((id) =>
              sourceAssociations.where('stop_times.stop_id', '=', id),
            ),
          )
          .execute();
      },
    );
  const stopRoutes: StopRouteAssociation[] = [];
  if (!reader.hasRootFilter) {
    // Whole-source reads avoid repeatedly traversing stop times in stop-ID order.
    // Check stop existence after deduplication, rather than once per stop time.
    for (const sourceId of new Set(stops.map((stop) => stop.source_id))) {
      const rows = await database
        .selectFrom(
          associations
            .where('stop_times.source_id', '=', sourceId)
            .as('stop_routes'),
        )
        .innerJoin('stops', (join) =>
          join
            .onRef('stops.source_id', '=', 'stop_routes.source_id')
            .onRef('stops.stop_id', '=', 'stop_routes.stop_id'),
        )
        .select([
          'stop_routes.source_id',
          'stop_routes.stop_id',
          'stop_routes.route_id',
        ])
        .$castTo<StopRouteAssociation>()
        .execute();
      if (useParentStation) {
        const selectedById = new Map(
          selectedStops
            .filter((stop) => stop.source_id === sourceId)
            .map((stop) => [stop.stop_id, stop]),
        );
        const emittedById = new Map(
          stops
            .filter((stop) => stop.source_id === sourceId)
            .map((stop) => [stop.stop_id, stop]),
        );
        const stationRoutes = new Map<string, Set<string>>();
        for (const row of rows) {
          if (emittedById.has(row.stop_id)) {
            stopRoutes.push(row);
          }
          const platform = selectedById.get(row.stop_id);
          if (
            platform?.parent_station &&
            (platform.location_type === 0 || platform.location_type === null) &&
            emittedById.get(platform.parent_station)?.location_type === 1
          ) {
            const routes =
              stationRoutes.get(platform.parent_station) ?? new Set<string>();
            routes.add(row.route_id);
            stationRoutes.set(platform.parent_station, routes);
          }
        }
        for (const [stopId, routeIds] of stationRoutes) {
          for (const routeId of routeIds) {
            stopRoutes.push({
              source_id: sourceId,
              stop_id: stopId,
              route_id: routeId,
            });
          }
        }
        continue;
      }
      for (const row of rows) {
        stopRoutes.push(row);
      }
    }
  } else {
    const rows = await readFilteredAssociations(stops);
    for (const row of rows) {
      stopRoutes.push(row);
    }
  }
  if (useParentStation && reader.hasRootFilter) {
    const children = await readSourceScopedBatches(
      stops.filter((stop) => stop.location_type === 1),
      (stop) => stop.stop_id,
      (sourceId, ids) =>
        database
          .selectFrom('stops')
          .where('source_id', '=', sourceId)
          .where('parent_station', 'in', ids)
          .where((eb) =>
            eb.or([
              eb('location_type', '=', 0),
              eb('location_type', 'is', null),
            ]),
          )
          .select(['source_id', 'stop_id', 'parent_station'])
          .$castTo<Pick<Stops, 'source_id' | 'stop_id' | 'parent_station'>>()
          .execute(),
    );
    const parentByChild = new Map(
      children.map((child) => [
        JSON.stringify([child.source_id, child.stop_id]),
        child.parent_station,
      ]),
    );
    const stationRoutes = new Map<string, StopRouteAssociation>();
    // Resolve every direct platform, including siblings outside the root filter,
    // then use the same bounded stop-index lookups as ordinary selected stops.
    for (const row of await readFilteredAssociations(children)) {
      const parentId = parentByChild.get(
        JSON.stringify([row.source_id, row.stop_id]),
      );
      if (parentId === null || parentId === undefined) {
        continue;
      }
      stationRoutes.set(
        JSON.stringify([row.source_id, parentId, row.route_id]),
        { source_id: row.source_id, stop_id: parentId, route_id: row.route_id },
      );
    }
    for (const association of stationRoutes.values()) {
      stopRoutes.push(association);
    }
  }
  const routes = await readSourceScopedBatches(
    stopRoutes,
    (association) => association.route_id,
    (sourceId, ids) =>
      select('routes')
        .where('source_id', '=', sourceId)
        .where('route_id', 'in', ids)
        .execute(),
  );
  const stopAttributes = reader.includeAttributes
    ? await readSourceScopedBatches(
        stops,
        (stop) => stop.stop_id,
        (sourceId, ids) =>
          select('stopAttributes')
            .where('source_id', '=', sourceId)
            .where('stop_id', 'in', ids)
            .execute(),
      )
    : [];
  const details = await reader.loadRouteDetails(routes);
  return { stops, stopRoutes, routes, stopAttributes, ...details };
}

export async function loadShapesGeoJSONData<DB>(
  context: LoadGtfsGeoJSONDataOptions<DB, 'shapes'>,
): Promise<ShapesGeoJSONData> {
  const reader = await createGeoJSONReader(context, 'shapes', context);
  const { database, select } = reader;
  const selectedShapes = await applyPortableQueryPredicates(
    select('shapes'),
    reader.predicates,
  )
    .clearSelect()
    .select(['source_id', 'shape_id'])
    .distinct()
    .orderBy('source_id')
    .orderBy('shape_id')
    .$castTo<Pick<Shapes, 'source_id' | 'shape_id'>>()
    .execute();
  const shapes = await readSourceScopedBatches(
    selectedShapes,
    (shape) => shape.shape_id,
    (sourceId, ids) =>
      select('shapes')
        .where('source_id', '=', sourceId)
        .where('shape_id', 'in', ids)
        .orderBy('shape_id')
        .orderBy('shape_pt_sequence')
        .execute(),
  );
  const shapeRoutesQuery = database
    .selectFrom('trips')
    .select(['trips.source_id', 'trips.shape_id', 'trips.route_id'])
    .distinct()
    .$castTo<ShapeRouteAssociation>();
  const shapeRoutes = await readSourceScopedBatches(
    selectedShapes,
    (shape) => shape.shape_id,
    (sourceId, ids) =>
      shapeRoutesQuery
        .where('trips.source_id', '=', sourceId)
        .where('trips.shape_id', 'in', ids)
        .execute(),
  );
  const routes = await readSourceScopedBatches(
    shapeRoutes,
    (association) => association.route_id,
    (sourceId, ids) =>
      select('routes')
        .where('source_id', '=', sourceId)
        .where('route_id', 'in', ids)
        .execute(),
  );
  const details = await reader.loadRouteDetails(routes);
  return { shapes, shapeRoutes, routes, ...details };
}

export async function loadRoutesGeoJSONData<DB>(
  context: LoadGtfsGeoJSONDataOptions<DB, 'routes'>,
): Promise<RoutesGeoJSONData> {
  const reader = await createGeoJSONReader(context, 'routes', context);
  const { database, select } = reader;
  const routes = await applyPortableQueryPredicates(
    select('routes'),
    reader.predicates,
  )
    .orderBy('source_id')
    .orderBy('route_id')
    .execute();
  const shapeRoutesQuery = database
    .selectFrom('trips')
    .where('trips.shape_id', 'is not', null)
    .select(['trips.source_id', 'trips.shape_id', 'trips.route_id'])
    .distinct()
    .$castTo<ShapeRouteAssociation>();
  const shapeRoutes = await readSourceScopedBatches(
    routes,
    (route) => route.route_id,
    (sourceId, ids) =>
      shapeRoutesQuery
        .where('trips.source_id', '=', sourceId)
        .where('trips.route_id', 'in', ids)
        .execute(),
  );
  const shapes = await readSourceScopedBatches(
    shapeRoutes,
    (association) => association.shape_id,
    async (sourceId, ids) => {
      const rows = await select('shapes')
        .where('source_id', '=', sourceId)
        .where('shape_id', 'in', ids)
        .orderBy('shape_id')
        .orderBy('shape_pt_sequence')
        .execute();
      // Retain compact geometry, not a full database row for every shape point.
      const groups = new Map<string, Shapes[]>();
      for (const row of rows) {
        const group = groups.get(row.shape_id);
        if (group === undefined) {
          groups.set(row.shape_id, [row]);
        } else {
          group.push(row);
        }
      }
      const shapes: RouteShape[] = [];
      for (const points of groups.values()) {
        const shape = createRouteShape(points);
        if (shape !== undefined) {
          shapes.push(shape);
        }
      }
      return shapes;
    },
    ROUTE_SHAPE_BATCH_SIZE,
  );
  const details = await reader.loadRouteDetails(routes);
  return { shapes, shapeRoutes, routes, ...details };
}
