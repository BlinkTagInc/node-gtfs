import type { CompiledGtfsTable } from '../schema/compile-table.ts';
import { compiledTableRegistry } from '../schema/table-registry.ts';
import type { RealtimeEntityType } from './writer.ts';

export const GTFS_REALTIME_ENTITY_TABLES: Readonly<{
  alert: typeof compiledTableRegistry.alerts;
  shape: typeof compiledTableRegistry.realtimeShapes;
  stop: typeof compiledTableRegistry.realtimeStops;
  trip_modifications: typeof compiledTableRegistry.tripModifications;
  trip_update: typeof compiledTableRegistry.tripUpdates;
  vehicle_position: typeof compiledTableRegistry.vehiclePositions;
}> = Object.freeze({
  alert: compiledTableRegistry.alerts,
  shape: compiledTableRegistry.realtimeShapes,
  stop: compiledTableRegistry.realtimeStops,
  trip_modifications: compiledTableRegistry.tripModifications,
  trip_update: compiledTableRegistry.tripUpdates,
  vehicle_position: compiledTableRegistry.vehiclePositions,
} satisfies Record<Exclude<RealtimeEntityType, 'unknown'>, CompiledGtfsTable>);

interface RealtimeChildRelationship {
  readonly parent:
    | typeof compiledTableRegistry.alerts
    | typeof compiledTableRegistry.tripUpdates;
  readonly child:
    | typeof compiledTableRegistry.alertEntitySelectors
    | typeof compiledTableRegistry.alertTimeRanges
    | typeof compiledTableRegistry.tripUpdateStopTimeUpdates;
  readonly entityIdColumn: 'alert_id' | 'trip_update_id';
}

export const GTFS_REALTIME_CHILD_RELATIONSHIPS: readonly RealtimeChildRelationship[] =
  Object.freeze([
    Object.freeze({
      parent: GTFS_REALTIME_ENTITY_TABLES.alert,
      child: compiledTableRegistry.alertEntitySelectors,
      entityIdColumn: 'alert_id',
    } as const),
    Object.freeze({
      parent: GTFS_REALTIME_ENTITY_TABLES.alert,
      child: compiledTableRegistry.alertTimeRanges,
      entityIdColumn: 'alert_id',
    } as const),
    Object.freeze({
      parent: GTFS_REALTIME_ENTITY_TABLES.trip_update,
      child: compiledTableRegistry.tripUpdateStopTimeUpdates,
      entityIdColumn: 'trip_update_id',
    } as const),
  ]);

const GTFS_REALTIME_CURRENT_CHILD_TABLES = Object.freeze(
  GTFS_REALTIME_CHILD_RELATIONSHIPS.map(({ child }) => child.tableName),
);

export const GTFS_REALTIME_CURRENT_PARENT_TABLES = Object.freeze(
  Object.values(GTFS_REALTIME_ENTITY_TABLES).map((table) => table.tableName),
);

/** Current-state tables in child-before-parent deletion order. */
export const GTFS_REALTIME_CURRENT_STATE_TABLES = Object.freeze([
  ...GTFS_REALTIME_CURRENT_CHILD_TABLES,
  ...GTFS_REALTIME_CURRENT_PARENT_TABLES,
]);
