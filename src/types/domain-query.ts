import type {
  GtfsDefaultRow,
  GtfsSelectableRow,
} from '../schema/define-table.ts';
import type { TableDefinitionByName } from '../schema/repository-fields.ts';
import type { GtfsCoordinateBounds } from '../schema/repository-query-extensions.ts';
import type { GtfsEqualityFilter, GtfsFieldOrder } from './repository.ts';

type Selectable<Name extends string> = GtfsSelectableRow<
  TableDefinitionByName<Name>
>;
type Field<Name extends string> = Extract<keyof Selectable<Name>, string>;

export interface GtfsReader<
  Name extends string,
  Row extends object = GtfsDefaultRow<TableDefinitionByName<Name>>,
> {
  where(filter: GtfsEqualityFilter<Name>): GtfsReader<Name, Row>;
  select<const Keys extends readonly [Field<Name>, ...Field<Name>[]]>(
    ...fields: Keys
  ): GtfsReader<Name, Pick<Selectable<Name>, Keys[number]>>;
  orderBy(order: readonly GtfsFieldOrder<Name>[]): GtfsReader<Name, Row>;
  limit(count: number): GtfsReader<Name, Row>;
  offset(count: number): GtfsReader<Name, Row>;
  count(): Promise<number>;
  all(): Promise<Row[]>;
  stream(): AsyncIterableIterator<Row>;
  first(filter?: GtfsEqualityFilter<Name>): Promise<Row | null>;
  firstOrThrow(filter?: GtfsEqualityFilter<Name>): Promise<Row>;
}

export interface GtfsStopsQueryOptions {
  readonly withinBounds?: GtfsCoordinateBounds;
  readonly useParentStation?: boolean;
}
export interface GtfsStopsForRouteOptions {
  readonly routeId: string;
  readonly serviceDate?: number;
  readonly useParentStation?: boolean;
}
export interface GtfsActiveTripsOptions {
  readonly serviceDate: number;
  readonly routeId?: string;
}
export interface GtfsStopTimesQueryOptions extends GtfsActiveTripsOptions {
  readonly stopId?: string;
  readonly window?: {
    readonly field: 'arrival_time' | 'departure_time';
    readonly start: string;
    readonly end: string;
  };
}
export interface GtfsDomainQueries {
  stops(options?: GtfsStopsQueryOptions): GtfsReader<'stops'>;
  stopsForRoute(options: GtfsStopsForRouteOptions): GtfsReader<'stops'>;
  activeTrips(options: GtfsActiveTripsOptions): GtfsReader<'trips'>;
  stopTimes(options: GtfsStopTimesQueryOptions): GtfsReader<'stop_times'>;
}
