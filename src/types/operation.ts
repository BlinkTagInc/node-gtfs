import type {
  GtfsExportConfig,
  GtfsScheduleSourceConfig,
  GtfsScheduleValidationConfig,
  GtfsRealtimeSourceConfig,
  GtfsRealtimeRetentionConfig,
} from './config.ts';
import type { GtfsReportingConfig } from '../reporting/types.ts';

export interface GtfsInstanceImportOptions {
  readonly signal?: AbortSignal;
  /** Complete replacement inputs for this call; identities must be in instance scope. */
  readonly sources?: readonly {
    readonly sourceId: string;
    readonly schedule: GtfsScheduleSourceConfig;
  }[];
  /** Overrides the specified validation fields on every selected source. */
  readonly validation?: GtfsScheduleValidationConfig;
  /** Replaces instance reporting for this call. */
  readonly reporting?: GtfsReportingConfig;
}

export interface GtfsInstanceRealtimeRefreshOptions {
  readonly signal?: AbortSignal;
  readonly sources?: readonly {
    readonly sourceId: string;
    readonly realtime: GtfsRealtimeSourceConfig;
  }[];
  /** Overrides the specified retention fields for this call. */
  readonly retention?: GtfsRealtimeRetentionConfig;
  readonly reporting?: GtfsReportingConfig;
}

export interface GtfsInstanceExportOptions extends GtfsExportConfig {
  readonly signal?: AbortSignal;
  readonly reporting?: GtfsReportingConfig;
}
