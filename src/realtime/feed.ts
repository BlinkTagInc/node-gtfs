import type { RawRealtimeEntity } from './normalizer.ts';
import type { GtfsRealtimeFeedType } from '../types/config.ts';
import type { GtfsValidationNotice } from '../diagnostics/errors.ts';
import type {
  RealtimeEntityType,
  RealtimeSnapshotApplication,
} from './writer.ts';

export interface DecodedRealtimeFeed {
  readonly header?: {
    readonly gtfsRealtimeVersion?: string;
    readonly incrementality?: string | number;
    readonly timestamp?: string | number | bigint | null;
  };
  readonly entity: readonly RawRealtimeEntity[];
}

export interface FetchedRealtimeFeed {
  readonly contentType: string | null;
  readonly feed: DecodedRealtimeFeed;
  readonly rawPayload: Buffer;
  readonly httpHeaders: Readonly<Record<string, string>>;
  readonly httpStatus: number;
}

export interface RealtimeSnapshotContext {
  readonly currentEntitiesSeconds: number;
  readonly snapshotsSeconds: number | null;
  readonly sourceId: string;
  readonly nowUnixSeconds: number;
  readonly realtimeFeedId: string;
  readonly feedUrl: string;
  readonly declaredFeedType?: GtfsRealtimeFeedType;
  readonly onNotice?: (notice: GtfsValidationNotice) => void;
}

export type ConcreteRealtimeEntityType = Exclude<RealtimeEntityType, 'unknown'>;
export type RealtimeApplicationMode =
  RealtimeSnapshotApplication['applicationMode'];

export const REALTIME_ENTITY_TYPES = [
  'alert',
  'trip_update',
  'vehicle_position',
  'shape',
  'stop',
  'trip_modifications',
] as const satisfies readonly ConcreteRealtimeEntityType[];

const FEED_TYPE_TO_ENTITY_TYPE = {
  alerts: 'alert',
  tripUpdates: 'trip_update',
  vehiclePositions: 'vehicle_position',
  shapes: 'shape',
  stops: 'stop',
  tripModifications: 'trip_modifications',
} as const satisfies Record<
  Exclude<GtfsRealtimeFeedType, 'mixed'>,
  ConcreteRealtimeEntityType
>;

const ENTITY_TYPE_TO_FEED_TYPE = Object.fromEntries(
  Object.entries(FEED_TYPE_TO_ENTITY_TYPE).map(([feedType, entityType]) => [
    entityType,
    feedType,
  ]),
) as Record<ConcreteRealtimeEntityType, Exclude<GtfsRealtimeFeedType, 'mixed'>>;

export function detectRealtimeEntityTypes(
  entity: RawRealtimeEntity,
): readonly ConcreteRealtimeEntityType[] {
  const types: ConcreteRealtimeEntityType[] = [];
  if (entity.alert != null) {
    types.push('alert');
  }
  if (entity.tripUpdate != null) {
    types.push('trip_update');
  }
  if (entity.vehicle != null) {
    types.push('vehicle_position');
  }
  if (entity.shape != null) {
    types.push('shape');
  }
  if (entity.stop != null) {
    types.push('stop');
  }
  if (entity.tripModifications != null) {
    types.push('trip_modifications');
  }
  return types;
}

export function normalizeRealtimeIncrementality(value: unknown): string {
  if (value === undefined || value === null || value === 0 || value === '0') {
    return 'FULL_DATASET';
  }
  if (value === 1 || value === '1') {
    return 'DIFFERENTIAL';
  }
  return String(value);
}

export function resolveRealtimeApplicationMode(
  incrementality: string,
): RealtimeApplicationMode {
  if (incrementality === 'FULL_DATASET') {
    return 'full';
  }
  if (incrementality === 'DIFFERENTIAL') {
    return 'differential';
  }
  return 'history-only';
}

export function inferRealtimeFeedType(
  entities: readonly RawRealtimeEntity[],
): GtfsRealtimeFeedType {
  const entityTypes = detectRealtimeFeedEntityTypes(entities);

  if (entityTypes.length !== 1) {
    return 'mixed';
  }

  const entityType = entityTypes[0];
  return entityType === undefined
    ? 'mixed'
    : ENTITY_TYPE_TO_FEED_TYPE[entityType];
}

export function detectRealtimeFeedEntityTypes(
  entities: readonly RawRealtimeEntity[],
): readonly ConcreteRealtimeEntityType[] {
  const detected = new Set<ConcreteRealtimeEntityType>();
  for (const entity of entities) {
    for (const entityType of detectRealtimeEntityTypes(entity)) {
      detected.add(entityType);
    }
  }
  return REALTIME_ENTITY_TYPES.filter((entityType) => detected.has(entityType));
}

export function getRealtimeFeedType(
  entityType: ConcreteRealtimeEntityType,
): Exclude<GtfsRealtimeFeedType, 'mixed'> {
  return ENTITY_TYPE_TO_FEED_TYPE[entityType];
}
