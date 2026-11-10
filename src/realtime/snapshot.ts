import { createHash } from 'node:crypto';

import {
  createGtfsConfigError,
  GtfsValidationNoticeCode,
  type GtfsValidationNotice,
} from '../diagnostics/errors.ts';
import {
  detectRealtimeFeedEntityTypes,
  getRealtimeFeedType,
  inferRealtimeFeedType,
  normalizeRealtimeIncrementality,
  resolveRealtimeApplicationMode,
  type FetchedRealtimeFeed,
  type RealtimeSnapshotContext,
} from './feed.ts';
import { createRealtimeSnapshotEntity } from './snapshot-entity.ts';
import { createRealtimeNotice } from './validation.ts';
import type { RealtimeSnapshotApplication } from './writer.ts';
import {
  collectValidationNotice,
  createValidationSummary,
  freezeValidationSummary,
  type GtfsValidationSummary,
} from '../validation/summary.ts';

function calculateRealtimeExpiration(
  nowUnixSeconds: number,
  retentionSeconds: number,
  setting: 'currentEntitiesSeconds' | 'snapshotsSeconds',
): number {
  const expiresAtUnixSeconds = nowUnixSeconds + retentionSeconds;
  if (!Number.isSafeInteger(expiresAtUnixSeconds) || expiresAtUnixSeconds < 0) {
    const path = `realtime.retention.${setting}`;
    throw createGtfsConfigError(
      `Configuration option \`${path}\` produces an unsafe expiration timestamp; reduce the retention duration`,
      { path, reason: 'invalid-value', retentionSeconds, nowUnixSeconds },
    );
  }
  return expiresAtUnixSeconds;
}

export function createRealtimeSnapshotApplication(
  fetched: FetchedRealtimeFeed,
  context: RealtimeSnapshotContext,
): {
  validation: GtfsValidationSummary;
  snapshot: RealtimeSnapshotApplication;
} {
  // Check expiration before entity normalization, which can skip invalid
  // entities, so a configuration error rejects even an empty feed.
  const expiresAtUnixSeconds = calculateRealtimeExpiration(
    context.nowUnixSeconds,
    context.currentEntitiesSeconds,
    'currentEntitiesSeconds',
  );
  const retentionExpiresAtUnixSeconds =
    context.snapshotsSeconds === null
      ? null
      : calculateRealtimeExpiration(
          context.nowUnixSeconds,
          context.snapshotsSeconds,
          'snapshotsSeconds',
        );
  const payloadSha256 = createHash('sha256')
    .update(fetched.rawPayload)
    .digest('hex');
  const snapshotId = payloadSha256;
  const incrementality = normalizeRealtimeIncrementality(
    fetched.feed.header?.incrementality,
  );
  const applicationMode = resolveRealtimeApplicationMode(incrementality);
  const entities = fetched.feed.entity ?? [];
  const notices: GtfsValidationNotice[] = [];
  const detectedEntityTypes = detectRealtimeFeedEntityTypes(entities);

  if (
    context.declaredFeedType !== undefined &&
    context.declaredFeedType !== 'mixed'
  ) {
    const detectedFeedTypes = detectedEntityTypes.map(getRealtimeFeedType);
    const unexpectedFeedTypes = detectedFeedTypes.filter(
      (feedType) => feedType !== context.declaredFeedType,
    );
    if (unexpectedFeedTypes.length > 0) {
      notices.unshift(
        createRealtimeNotice(context, snapshotId, {
          code: GtfsValidationNoticeCode.REALTIME_FEED_TYPE_MISMATCH,
          severity: 'error',
          message: `Realtime feed ${JSON.stringify(context.realtimeFeedId)} is configured as ${JSON.stringify(context.declaredFeedType)} but contains ${unexpectedFeedTypes.map((feedType) => JSON.stringify(feedType)).join(', ')}; check the \`sources[].realtime.feeds[].type\` configuration option`,
          details: {
            declaredFeedType: context.declaredFeedType,
            detectedFeedTypes,
            unexpectedFeedTypes,
          },
        }),
      );
    }
  }

  if (applicationMode === 'history-only') {
    notices.unshift(
      createRealtimeNotice(context, snapshotId, {
        code: GtfsValidationNoticeCode.REALTIME_INCREMENTALITY_UNSUPPORTED,
        message: `Snapshot incrementality ${JSON.stringify(incrementality)} is unsupported; raw history was retained without changing current rows`,
      }),
    );
  }

  const validation = createValidationSummary();
  const reportNotice = (notice: GtfsValidationNotice) => {
    collectValidationNotice(validation, notice);
    context.onNotice?.(notice);
  };
  for (const notice of notices) {
    reportNotice(notice);
  }
  const snapshotEntities = entities.map((entity, entityOrdinal) => {
    const result = createRealtimeSnapshotEntity(entity, entityOrdinal, {
      applicationMode,
      normalization: {
        nowUnixSeconds: context.nowUnixSeconds,
        expiresAtUnixSeconds,
        realtimeFeedId: context.realtimeFeedId,
        sourceId: context.sourceId,
      },
      snapshot: context,
      snapshotId,
      onNotice: reportNotice,
    });
    return result;
  });

  return {
    validation: freezeValidationSummary(validation),
    snapshot: {
      sourceId: context.sourceId,
      realtimeFeedId: context.realtimeFeedId,
      feedType: context.declaredFeedType ?? inferRealtimeFeedType(entities),
      feedUrl: context.feedUrl,
      snapshotId,
      fetchedAtUnixSeconds: context.nowUnixSeconds,
      httpStatus: fetched.httpStatus,
      httpHeaders: JSON.stringify(fetched.httpHeaders),
      contentType: fetched.contentType,
      feedHeaderVersion: fetched.feed.header?.gtfsRealtimeVersion ?? null,
      feedHeaderIncrementality: incrementality,
      feedHeaderUnixSeconds: fetched.feed.header?.timestamp ?? null,
      payloadSha256,
      rawPayloadBase64: fetched.rawPayload.toString('base64'),
      retentionExpiresAtUnixSeconds,
      applicationMode,
      entities: snapshotEntities,
    },
  };
}
