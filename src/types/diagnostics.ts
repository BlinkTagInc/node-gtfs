import type { GtfsConfigIssue } from '../config/validation.ts';
import type { GtfsValidationSummary } from '../validation/summary.ts';

export type { GtfsConfigIssue } from '../config/validation.ts';
export type {
  GtfsCsvSourcePosition,
  GtfsGeoJSONSourcePosition,
  GtfsRealtimeSourcePosition,
  GtfsDiagnosticPosition,
  GtfsSourcePosition,
} from '../diagnostics/position.ts';

/** Optional structured context attached to a GTFS error. */
export interface GtfsErrorDetails {
  /** Cleanup or a transaction boundary failed; inspect state before reuse or retry. */
  readonly databaseRecoveryRequired?: true;
  /** Configuration issues, each identifying its configuration path. */
  readonly errors?: readonly GtfsConfigIssue[];
  /** Complete counts and bounded notice samples from a rejected validation pass. */
  readonly validation?: GtfsValidationSummary;
  readonly [key: string]: unknown;
}

/** Structured context attached to a validation notice. */
export interface GtfsValidationNoticeDetails {
  readonly [key: string]: unknown;
}
