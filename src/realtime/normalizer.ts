import { get } from 'lodash-es';
import type { transit_realtime } from 'gtfs-realtime-bindings';

import type { CompiledGtfsColumn } from '../schema/compile-table.ts';
import { compiledTableRegistry } from '../schema/table-registry.ts';
import type {
  NormalizedRealtimeRow,
  NormalizedRealtimeValue,
  RealtimeEntityType,
  RealtimeMutation,
} from './writer.ts';
import type { InspectedRealtimeAlertPeriod } from './alert-time-ranges.ts';
import {
  GTFS_REALTIME_ENTITY_TABLES,
  GTFS_REALTIME_CHILD_RELATIONSHIPS,
} from './entity-tables.ts';

export type RawRealtimeEntity = transit_realtime.IFeedEntity;

export interface RealtimeNormalizationContext {
  readonly nowUnixSeconds: number;
  readonly expiresAtUnixSeconds: number;
  readonly realtimeFeedId: string;
  readonly sourceId: string;
}

const {
  alertEntitySelectors: alertEntitySelectorsTable,
  alertTimeRanges: alertTimeRangesTable,
  tripUpdateStopTimeUpdates: tripUpdateStopTimeUpdatesTable,
} = compiledTableRegistry;

function asRealtimeValue(
  value: unknown,
  fieldName: string,
): NormalizedRealtimeValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    value instanceof Uint8Array
  ) {
    return value;
  }

  throw new TypeError(
    `Unsupported value for realtime field ${fieldName}: ${typeof value}`,
  );
}

function normalizeFieldValue(
  entity: unknown,
  column: CompiledGtfsColumn,
  context: RealtimeNormalizationContext,
): NormalizedRealtimeValue {
  if (column.name === 'realtime_feed_id') {
    return context.realtimeFeedId;
  }
  if (column.name === 'selector_ordinal') {
    return asRealtimeValue(
      (entity as { selectorOrdinal?: unknown }).selectorOrdinal,
      column.name,
    );
  }
  if (column.name === 'range_kind') {
    return asRealtimeValue(
      (entity as { rangeKind?: unknown }).rangeKind,
      column.name,
    );
  }
  if (column.name === 'range_ordinal') {
    return asRealtimeValue(
      (entity as { rangeOrdinal?: unknown }).rangeOrdinal,
      column.name,
    );
  }
  if (column.name === 'is_valid') {
    return asRealtimeValue(
      (entity as { isValid?: unknown }).isValid,
      column.name,
    );
  }
  if (column.name === 'stop_time_update_ordinal') {
    return asRealtimeValue(
      (entity as { stopTimeUpdateOrdinal?: unknown }).stopTimeUpdateOrdinal,
      column.name,
    );
  }

  if (column.name === 'created_at_unix_seconds') {
    return context.nowUnixSeconds;
  }

  if (column.name === 'expires_at_unix_seconds') {
    return context.expiresAtUnixSeconds;
  }

  const baseValue =
    (column.sourcePath === undefined
      ? column.defaultValue
      : get(entity, column.sourcePath, column.defaultValue)) ?? null;
  if (column.valueKind === 'json') {
    return baseValue == null ? null : JSON.stringify(baseValue);
  }

  return asRealtimeValue(baseValue, column.name);
}

function normalizeRow(
  entity: unknown,
  table: (typeof compiledTableRegistry)[keyof typeof compiledTableRegistry],
  context: RealtimeNormalizationContext,
): NormalizedRealtimeRow {
  return Object.fromEntries([
    ['source_id', context.sourceId],
    ...table.columns.map((column) => [
      column.name,
      normalizeFieldValue(entity, column, context),
    ]),
  ]);
}

function normalizeRealtimeChildDeletions(
  entityType: Exclude<RealtimeEntityType, 'unknown'>,
  entityId: NormalizedRealtimeValue,
  context: RealtimeNormalizationContext,
): readonly RealtimeMutation[] {
  return GTFS_REALTIME_CHILD_RELATIONSHIPS.filter(
    ({ parent }) => parent === GTFS_REALTIME_ENTITY_TABLES[entityType],
  ).map(({ child, entityIdColumn }) => ({
    operation: 'delete',
    table: child,
    where: [
      { field: 'source_id', value: context.sourceId },
      { field: 'realtime_feed_id', value: context.realtimeFeedId },
      { field: entityIdColumn, value: entityId },
    ],
  }));
}

function normalizeAlert(
  entity: RawRealtimeEntity,
  context: RealtimeNormalizationContext,
  periods: readonly InspectedRealtimeAlertPeriod[],
): readonly RealtimeMutation[] {
  const table = GTFS_REALTIME_ENTITY_TABLES.alert;
  const mutations: RealtimeMutation[] = [
    ...normalizeRealtimeChildDeletions(
      'alert',
      asRealtimeValue(entity.id, 'alert_id'),
      context,
    ),
    {
      operation: 'replace',
      table,
      row: normalizeRow(entity, table, context),
    },
  ];

  for (const period of periods) {
    mutations.push({
      operation: 'replace',
      table: alertTimeRangesTable,
      row: normalizeRow(
        {
          parent: entity,
          rangeKind: period.rangeKind,
          rangeOrdinal: period.rangeOrdinal,
          start: period.startUnixSeconds,
          end: period.endUnixSeconds,
          isValid: period.isValid,
        },
        alertTimeRangesTable,
        context,
      ),
    });
  }

  for (const [selectorOrdinal, informedEntity] of (
    entity.alert?.informedEntity ?? []
  ).entries()) {
    mutations.push({
      operation: 'replace',
      table: alertEntitySelectorsTable,
      row: normalizeRow(
        { ...informedEntity, parent: entity, selectorOrdinal },
        alertEntitySelectorsTable,
        context,
      ),
    });
  }

  return mutations;
}

function normalizeTripUpdate(
  entity: RawRealtimeEntity,
  context: RealtimeNormalizationContext,
): readonly RealtimeMutation[] {
  const table = GTFS_REALTIME_ENTITY_TABLES.trip_update;
  const mutations: RealtimeMutation[] = [
    ...normalizeRealtimeChildDeletions(
      'trip_update',
      asRealtimeValue(entity.id, 'trip_update_id'),
      context,
    ),
  ];
  const tripId = entity.tripUpdate?.trip?.tripId ?? null;
  const tripStartTime = entity.tripUpdate?.trip?.startTime ?? null;

  if (tripId !== null) {
    mutations.push({
      operation: 'delete',
      table: tripUpdateStopTimeUpdatesTable,
      where: [
        { field: 'source_id', value: context.sourceId },
        { field: 'realtime_feed_id', value: context.realtimeFeedId },
        { field: 'trip_id', value: asRealtimeValue(tripId, 'trip_id') },
        {
          field: 'trip_start_time',
          value: asRealtimeValue(tripStartTime, 'trip_start_time'),
          nullSafe: true,
        },
      ],
    });
  }

  mutations.push({
    operation: 'replace',
    table,
    row: normalizeRow(entity, table, context),
  });
  const stopTimeUpdates = entity.tripUpdate?.stopTimeUpdate ?? [];

  for (const [
    stopTimeUpdateOrdinal,
    stopTimeUpdate,
  ] of stopTimeUpdates.entries()) {
    mutations.push({
      operation: 'replace',
      table: tripUpdateStopTimeUpdatesTable,
      row: normalizeRow(
        { ...stopTimeUpdate, parent: entity, stopTimeUpdateOrdinal },
        tripUpdateStopTimeUpdatesTable,
        context,
      ),
    });
  }

  return mutations;
}

export function normalizeRealtimeEntity({
  entityType,
  entity,
  context,
  alertPeriods,
}: {
  readonly entityType: Exclude<RealtimeEntityType, 'unknown'>;
  readonly entity: RawRealtimeEntity;
  readonly context: RealtimeNormalizationContext;
  readonly alertPeriods: readonly InspectedRealtimeAlertPeriod[];
}): readonly RealtimeMutation[] {
  if (entityType === 'alert') {
    return normalizeAlert(entity, context, alertPeriods);
  }
  if (entityType === 'trip_update') {
    return normalizeTripUpdate(entity, context);
  }

  const table = GTFS_REALTIME_ENTITY_TABLES[entityType];
  return [
    {
      operation: 'replace',
      table,
      row: normalizeRow(entity, table, context),
    },
  ];
}

/** Builds source-scoped current-row deletion mutations for a tombstone. */
export function normalizeRealtimeDeletion(
  entityType: Exclude<RealtimeEntityType, 'unknown'>,
  entityId: string,
  context: RealtimeNormalizationContext,
): readonly RealtimeMutation[] {
  return [
    ...normalizeRealtimeChildDeletions(entityType, entityId, context),
    {
      operation: 'delete',
      table: GTFS_REALTIME_ENTITY_TABLES[entityType],
      where: [
        { field: 'source_id', value: context.sourceId },
        { field: 'realtime_feed_id', value: context.realtimeFeedId },
        { field: 'entity_id', value: entityId },
      ],
    },
  ];
}
