import {
  GtfsValidationNoticeCode,
  type GtfsValidationNotice,
} from '../diagnostics/errors.ts';
import {
  inspectRealtimeAlertPeriods,
  type InspectedRealtimeAlertPeriod,
} from './alert-time-ranges.ts';
import {
  detectRealtimeEntityTypes,
  REALTIME_ENTITY_TYPES,
  type ConcreteRealtimeEntityType,
  type RealtimeApplicationMode,
  type RealtimeSnapshotContext,
} from './feed.ts';
import {
  normalizeRealtimeDeletion,
  normalizeRealtimeEntity,
  type RawRealtimeEntity,
  type RealtimeNormalizationContext,
} from './normalizer.ts';
import {
  createRealtimeAlertPeriodNotice,
  createRealtimeNotice,
} from './validation.ts';
import type {
  RealtimeEntityType,
  RealtimeMutation,
  RealtimeSnapshotEntity,
} from './writer.ts';

interface SnapshotEntityContext {
  readonly applicationMode: RealtimeApplicationMode;
  readonly normalization: RealtimeNormalizationContext;
  readonly snapshot: RealtimeSnapshotContext;
  readonly snapshotId: string;
  readonly onNotice: (notice: GtfsValidationNotice) => void;
}

interface CurrentMutationResult {
  readonly currentMutations: readonly RealtimeMutation[];
  readonly notices: readonly GtfsValidationNotice[];
}

function createEntityNotice(
  context: SnapshotEntityContext,
  entityOrdinal: number,
  entityId: string | null,
  options: {
    code: GtfsValidationNotice['code'];
    message: string;
  },
): GtfsValidationNotice {
  return createRealtimeNotice(context.snapshot, context.snapshotId, {
    ...options,
    entityOrdinal,
    entityId,
  });
}

function createRealtimeDeletionMutations(
  entityTypes: readonly ConcreteRealtimeEntityType[],
  entityId: string,
  context: SnapshotEntityContext,
): readonly RealtimeMutation[] {
  // A payload-free tombstone must remove the ID from every current table.
  const deletionTypes =
    entityTypes.length === 0 ? REALTIME_ENTITY_TYPES : entityTypes;
  return deletionTypes.flatMap((entityType) =>
    normalizeRealtimeDeletion(entityType, entityId, context.normalization),
  );
}

function createRealtimeCurrentMutations(
  entity: RawRealtimeEntity,
  entityTypes: readonly ConcreteRealtimeEntityType[],
  entityId: string,
  entityOrdinal: number,
  context: SnapshotEntityContext,
  alertPeriods: readonly InspectedRealtimeAlertPeriod[],
): CurrentMutationResult {
  if (context.applicationMode === 'history-only') {
    return { currentMutations: [], notices: [] };
  }

  if (entity.isDeleted === true) {
    if (context.applicationMode === 'full') {
      return {
        currentMutations: [],
        notices: [
          createEntityNotice(context, entityOrdinal, entityId, {
            code: GtfsValidationNoticeCode.REALTIME_TOMBSTONE_IN_FULL_DATASET,
            message:
              'FeedEntity.is_deleted is ignored in full snapshots; prior current rows are replaced',
          }),
        ],
      };
    }
    if (entityTypes.length > 1) {
      return {
        currentMutations: [],
        notices: [
          createEntityNotice(context, entityOrdinal, entityId, {
            code: GtfsValidationNoticeCode.REALTIME_TOMBSTONE_AMBIGUOUS,
            message:
              'Differential tombstone has multiple payload types; deletion was skipped and raw history retained',
          }),
        ],
      };
    }
    return {
      currentMutations: createRealtimeDeletionMutations(
        entityTypes,
        entityId,
        context,
      ),
      notices: [],
    };
  }

  const entityType = entityTypes.at(0);
  if (entityTypes.length !== 1 || entityType === undefined) {
    return {
      currentMutations: [],
      notices: [
        createEntityNotice(context, entityOrdinal, entityId, {
          code: GtfsValidationNoticeCode.REALTIME_ENTITY_TYPE_AMBIGUOUS,
          message:
            entityTypes.length === 0
              ? 'FeedEntity has no supported payload; raw history was retained'
              : 'FeedEntity has multiple supported payloads; entity was skipped and raw history retained',
        }),
      ],
    };
  }

  try {
    return {
      currentMutations: normalizeRealtimeEntity({
        entityType,
        entity,
        context: context.normalization,
        alertPeriods,
      }),
      notices: [],
    };
  } catch {
    return {
      currentMutations: [],
      notices: [
        createEntityNotice(context, entityOrdinal, entityId, {
          code: GtfsValidationNoticeCode.REALTIME_ENTITY_UNSUPPORTED,
          message:
            'FeedEntity could not be normalized; raw history was retained',
        }),
      ],
    };
  }
}

export function createRealtimeSnapshotEntity(
  entity: RawRealtimeEntity,
  entityOrdinal: number,
  context: SnapshotEntityContext,
): RealtimeSnapshotEntity {
  const entityId =
    typeof entity.id === 'string' && entity.id.length > 0 ? entity.id : null;
  const entityTypes = detectRealtimeEntityTypes(entity);
  const detectedEntityType = entityTypes.at(0);
  const entityType: RealtimeEntityType =
    entityTypes.length === 1 && detectedEntityType !== undefined
      ? detectedEntityType
      : 'unknown';
  const alertPeriods =
    entity.alert == null
      ? { periods: [] }
      : inspectRealtimeAlertPeriods(entity.alert, (issue) => {
          context.onNotice(
            createRealtimeAlertPeriodNotice({
              issue,
              entityOrdinal,
              entityId,
              snapshot: context.snapshot,
              snapshotId: context.snapshotId,
            }),
          );
        });

  let mutations: readonly RealtimeMutation[] = [];
  if (entityId === null) {
    context.onNotice(
      createEntityNotice(context, entityOrdinal, entityId, {
        code: GtfsValidationNoticeCode.REALTIME_ENTITY_ID_MISSING,
        message:
          'FeedEntity.id is missing or empty; entity was skipped and raw history retained',
      }),
    );
  } else {
    const current = createRealtimeCurrentMutations(
      entity,
      entityTypes,
      entityId,
      entityOrdinal,
      context,
      alertPeriods.periods,
    );
    mutations = current.currentMutations;
    for (const notice of current.notices) {
      context.onNotice(notice);
    }
  }

  return {
    entityOrdinal,
    entityId,
    entityType,
    isDeleted: entity.isDeleted === true,
    entityJson: JSON.stringify(entity),
    currentMutations: mutations,
  };
}
