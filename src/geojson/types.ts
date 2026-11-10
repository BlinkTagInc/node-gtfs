import type {
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
} from 'geojson';

import type { Expression, ExpressionBuilder, SqlBool } from 'kysely';
import type { GtfsDatabase } from '../schema/database.ts';
import type { GtfsEqualityFilter } from '../types/repository.ts';
import type {
  RouteAttributes,
  Routes,
  StopAttributes,
  Stops,
} from '../schema/row-types.ts';

export type GeoJSONRowProperties<Row> = {
  readonly [
    Field in keyof Row as null extends Row[Field] ? never : Field
  ]: Row[Field];
} & {
  readonly [
    Field in keyof Row as null extends Row[Field] ? Field : never
  ]?: NonNullable<Row[Field]>;
};

export interface GtfsGeoJSONFilters<
  Table extends 'stops' | 'shapes' | 'routes',
> {
  readonly where?: GtfsEqualityFilter<Table>;
  readonly routeId?: string;
  readonly serviceDate?: number;
  /** Trusted SQL predicate. Correlate subqueries by source/feed identity explicitly. */
  readonly sqlWhere?: (
    eb: ExpressionBuilder<GtfsDatabase, Table>,
  ) => Expression<SqlBool>;
}

export interface GtfsGeoJSONStopsOptions extends GtfsGeoJSONFilters<'stops'> {
  /** Use parent stations instead of children; false excludes stations. Defaults to false. */
  readonly useParentStation?: boolean;
}
export type GtfsGeoJSONShapesOptions = GtfsGeoJSONFilters<'shapes'>;
export type GtfsGeoJSONRoutesOptions = GtfsGeoJSONFilters<'routes'>;

export type GtfsRouteGeoJSONProperties = GeoJSONRowProperties<
  Omit<Routes, 'route_color' | 'route_text_color'>
> &
  Partial<
    GeoJSONRowProperties<Omit<RouteAttributes, 'source_id' | 'route_id'>>
  > & {
    readonly agency_name?: string;
    readonly route_color?: `#${string}`;
    readonly route_text_color?: `#${string}`;
  };

export type GtfsStopGeoJSONProperties = GeoJSONRowProperties<
  Omit<Stops, 'stop_lat' | 'stop_lon'>
> &
  Partial<
    GeoJSONRowProperties<Omit<StopAttributes, 'source_id' | 'stop_id'>>
  > & {
    readonly routes: readonly GtfsRouteGeoJSONProperties[];
    readonly agency_name?: string;
  };

export interface GtfsShapeGeoJSONProperties {
  readonly source_id: string;
  readonly shape_id: string;
  readonly routes: readonly GtfsRouteGeoJSONProperties[];
  readonly agency_name?: string;
}

export interface GtfsGeoJSON {
  stops(
    options?: GtfsGeoJSONStopsOptions,
  ): Promise<FeatureCollection<Point, GtfsStopGeoJSONProperties>>;
  shapes(
    options?: GtfsGeoJSONShapesOptions,
  ): Promise<FeatureCollection<LineString, GtfsShapeGeoJSONProperties>>;
  routes(
    options?: GtfsGeoJSONRoutesOptions,
  ): Promise<FeatureCollection<MultiLineString, GtfsRouteGeoJSONProperties>>;
}
