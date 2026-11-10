import type { GtfsReportEvent } from './events.ts';

/** Output threshold for a reporter. */
export type GtfsReportingLevel = 'silent' | 'error' | 'warn' | 'info';

export type GtfsLogMessageLevel = Exclude<GtfsReportingLevel, 'silent'>;

/** Receives one immutable structured event synchronously. */
export type GtfsReporter = (event: GtfsReportEvent) => void;

export interface GtfsReportingConfig<ReporterValue = GtfsReporter> {
  /** How much to deliver to `reporter`. Defaults to `info` when supplied. */
  readonly level?: GtfsReportingLevel;
  /** Optional synchronous structured event destination. Libraries are otherwise silent. */
  readonly reporter?: ReporterValue;
}

export type {
  GtfsOperationName,
  GtfsReportEvent,
  GtfsReportedError,
} from './events.ts';
