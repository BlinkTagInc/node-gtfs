import { get } from 'lodash-es';

import type { CompiledGtfsColumn } from '../schema/compile-table.ts';
import { compiledTableRegistry } from '../schema/table-registry.ts';
import { applyPrefixToValue, convertLongTimeToDate } from './utils.ts';
import type {
  NormalizedRealtimeEntity,
  NormalizedRealtimeRow,
  NormalizedRealtimeValue,
  RealtimeMutation,
} from './gtfs-realtime-writer.ts';

export interface RawRealtimeEntity {
  id: string;
  alert?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  tripUpdate?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  vehicle?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type RealtimeFeedKind = 'alerts' | 'tripupdates' | 'vehiclepositions';

export interface RealtimeNormalizationContext {
  currentTimestamp: number;
  expirationSeconds: number;
  prefix?: string;
}

const {
  serviceAlerts: serviceAlertsTable,
  serviceAlertInformedEntities: informedEntitiesTable,
  tripUpdates: tripUpdatesTable,
  stopTimeUpdates: stopTimeUpdatesTable,
  vehiclePositions: vehiclePositionsTable,
} = compiledTableRegistry;

function asRealtimeValue(
  value: unknown,
  fieldName: string,
): NormalizedRealtimeValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
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
  if (column.name === 'created_timestamp') {
    return context.currentTimestamp;
  }

  if (column.name === 'expiration_timestamp') {
    return context.currentTimestamp + context.expirationSeconds;
  }

  const baseValue =
    (column.sourcePath === undefined
      ? column.defaultValue
      : get(entity, column.sourcePath, column.defaultValue)) ?? null;
  const timeAdjustedValue = (baseValue as { __isLong__?: boolean } | null)
    ?.__isLong__
    ? convertLongTimeToDate(
        baseValue as unknown as {
          high: number;
          low: number;
          unsigned: boolean;
        },
      )
    : baseValue;
  const prefixedValue = applyPrefixToValue(
    timeAdjustedValue,
    column.applyFeedPrefix,
    context.prefix,
  );

  if (column.storageKind === 'json') {
    return prefixedValue == null ? null : JSON.stringify(prefixedValue);
  }

  return asRealtimeValue(prefixedValue, column.name);
}

function normalizeRow(
  entity: unknown,
  table: (typeof compiledTableRegistry)[keyof typeof compiledTableRegistry],
  context: RealtimeNormalizationContext,
): NormalizedRealtimeRow {
  return Object.fromEntries(
    table.columns.map((column) => [
      column.name,
      normalizeFieldValue(entity, column, context),
    ]),
  );
}

function normalizeAlert(
  entity: RawRealtimeEntity,
  context: RealtimeNormalizationContext,
): NormalizedRealtimeEntity {
  const alertId = applyPrefixToValue(entity.id, true, context.prefix);
  const mutations: RealtimeMutation[] = [
    {
      operation: 'delete',
      table: informedEntitiesTable,
      where: [
        {
          field: 'alert_id',
          value: asRealtimeValue(alertId, 'alert_id'),
        },
      ],
    },
    {
      operation: 'replace',
      table: serviceAlertsTable,
      row: normalizeRow(entity, serviceAlertsTable, context),
    },
  ];

  for (const informedEntity of entity.alert?.informedEntity ?? []) {
    mutations.push({
      operation: 'replace',
      table: informedEntitiesTable,
      row: normalizeRow(
        { ...informedEntity, parent: entity },
        informedEntitiesTable,
        context,
      ),
    });
  }

  return { mutations };
}

function normalizeTripUpdate(
  entity: RawRealtimeEntity,
  context: RealtimeNormalizationContext,
): NormalizedRealtimeEntity {
  const mutations: RealtimeMutation[] = [
    {
      operation: 'replace',
      table: tripUpdatesTable,
      row: normalizeRow(entity, tripUpdatesTable, context),
    },
  ];
  const stopTimeUpdates = entity.tripUpdate?.stopTimeUpdate ?? [];

  if (stopTimeUpdates.length > 0) {
    const tripId = applyPrefixToValue(
      entity.tripUpdate?.trip?.tripId ?? null,
      true,
      context.prefix,
    );
    const tripStartTime = entity.tripUpdate?.trip?.startTime ?? null;

    if (tripId !== null) {
      mutations.push({
        operation: 'delete',
        table: stopTimeUpdatesTable,
        where: [
          {
            field: 'trip_id',
            value: asRealtimeValue(tripId, 'trip_id'),
          },
          {
            field: 'trip_start_time',
            value: asRealtimeValue(tripStartTime, 'trip_start_time'),
            nullSafe: true,
          },
        ],
      });
    }

    for (const stopTimeUpdate of stopTimeUpdates) {
      mutations.push({
        operation: 'replace',
        table: stopTimeUpdatesTable,
        row: normalizeRow(
          { ...stopTimeUpdate, parent: entity },
          stopTimeUpdatesTable,
          context,
        ),
      });
    }
  }

  return { mutations };
}

export function normalizeRealtimeEntity(
  kind: RealtimeFeedKind,
  entity: RawRealtimeEntity,
  context: RealtimeNormalizationContext,
): NormalizedRealtimeEntity {
  if (kind === 'alerts') return normalizeAlert(entity, context);
  if (kind === 'tripupdates') return normalizeTripUpdate(entity, context);

  return {
    mutations: [
      {
        operation: 'replace',
        table: vehiclePositionsTable,
        row: normalizeRow(entity, vehiclePositionsTable, context),
      },
    ],
  };
}
