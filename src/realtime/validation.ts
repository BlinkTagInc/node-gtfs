import {
  GtfsValidationNoticeCode,
  type GtfsValidationNotice,
} from '../diagnostics/errors.ts';
import type { RealtimeAlertPeriodIssue } from './alert-time-ranges.ts';
import { redactUrlForReporting } from '../reporting/format.ts';
import type { RealtimeSnapshotContext } from './feed.ts';

interface RealtimeNoticeOptions {
  readonly code: GtfsValidationNotice['code'];
  readonly message: string;
  readonly entityOrdinal?: number;
  readonly entityId?: string | null;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly severity?: GtfsValidationNotice['severity'];
}

export function createRealtimeNotice(
  context: RealtimeSnapshotContext,
  snapshotId: string,
  options: RealtimeNoticeOptions,
): GtfsValidationNotice {
  const { code, message, entityOrdinal, entityId, details, severity } = options;
  return {
    code,
    severity: severity ?? 'warn',
    message,
    filename: redactUrlForReporting(context.feedUrl),
    sourceId: context.sourceId,
    ...(entityOrdinal === undefined
      ? {}
      : {
          position: {
            kind: 'realtime' as const,
            entityNumber: entityOrdinal + 1,
          },
        }),
    details: {
      realtimeFeedId: context.realtimeFeedId,
      snapshotId,
      ...(entityId === undefined ? {} : { entityId }),
      ...details,
    },
  };
}

export function createRealtimeAlertPeriodNotice(options: {
  readonly issue: RealtimeAlertPeriodIssue;
  readonly entityOrdinal: number;
  readonly entityId: string | null;
  readonly snapshot: RealtimeSnapshotContext;
  readonly snapshotId: string;
}): GtfsValidationNotice {
  const { issue, entityOrdinal, entityId, snapshot, snapshotId } = options;
  return createRealtimeNotice(snapshot, snapshotId, {
    code:
      issue.kind === 'invalid-range'
        ? GtfsValidationNoticeCode.REALTIME_ALERT_PERIOD_INVALID
        : GtfsValidationNoticeCode.REALTIME_ALERT_IMPACT_NOT_CONTAINED,
    message: issue.message,
    entityOrdinal,
    entityId,
    details: {
      rangeKind: issue.rangeKind,
      rangeOrdinal: issue.rangeOrdinal,
    },
  });
}
