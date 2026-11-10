import type {
  GtfsErrorCategory,
  GtfsErrorCode,
  GtfsValidationNotice,
} from '../diagnostics/errors.ts';
import type { GtfsReportingLevel, GtfsLogMessageLevel } from './types.ts';
import type { GtfsErrorDetails } from '../types/diagnostics.ts';
import type {
  GtfsDiagnosticPosition,
  GtfsSourcePosition,
} from '../diagnostics/position.ts';

export type GtfsOperationName =
  'cleanup' | 'export' | 'import' | 'realtime' | 'validation';

export interface GtfsReportedError extends GtfsDiagnosticPosition {
  readonly name: string;
  readonly message: string;
  readonly code?: GtfsErrorCode;
  readonly category?: GtfsErrorCategory;
  readonly statusCode?: number;
  readonly details?: GtfsErrorDetails;
}

interface GtfsReportEventBase {
  readonly type: string;
  readonly level: GtfsLogMessageLevel;
  /** Unix milliseconds recorded immediately before synchronous delivery. */
  readonly timestampMs: number;
  /** Stable identifier shared by events emitted through one operation config. */
  readonly operationId: string;
  /** Human presentation text; structured fields remain authoritative. */
  readonly message: string;
}

export type GtfsReportEvent =
  | (GtfsReportEventBase &
      GtfsDiagnosticPosition & {
        readonly type: 'message';
        readonly error?: GtfsReportedError;
        readonly sourceId?: string;
        readonly filename?: string;
      })
  | (GtfsReportEventBase & {
      readonly type: 'operation:start';
      readonly operation: GtfsOperationName;
      readonly sourceCount?: number;
      readonly sourceIds?: readonly string[];
      readonly databaseDescription?: string;
    })
  | (GtfsReportEventBase & {
      readonly type: 'progress';
      /** Set false for a spinner and count without a progress bar. */
      readonly progressBar?: boolean;
      readonly operation?: GtfsOperationName;
      readonly sourceId?: string;
      readonly filename?: string;
      readonly current?: number;
      readonly total?: number;
    })
  | (GtfsReportEventBase & {
      readonly type: 'status';
      readonly progressBar?: boolean;
      readonly phase?: 'start' | 'complete';
      /** Whether this task gets a console heading. Defaults to true. */
      readonly heading?: boolean;
      readonly databaseDescription?: string;
      readonly operation?: GtfsOperationName;
      readonly sourceId?: string;
      readonly filename?: string;
    })
  | (GtfsReportEventBase & {
      readonly type: 'validation:notice';
      readonly operation: 'import' | 'realtime' | 'validation';
      readonly notice: Readonly<GtfsValidationNotice>;
      readonly sourceId?: string;
      readonly filename: string;
      readonly position?: GtfsSourcePosition;
      readonly firstPosition?: GtfsSourcePosition;
    })
  | (GtfsReportEventBase & {
      readonly type: 'schema:recreate';
      readonly databaseDescription: string;
      readonly tables: readonly string[];
    })
  | (GtfsReportEventBase & {
      readonly type: 'operation:complete';
      readonly databaseDescription?: string;
      readonly operation: GtfsOperationName;
      readonly durationMs: number;
      readonly destination?: string;
      readonly summary?: string;
      readonly result?: Readonly<Record<string, unknown>>;
    });

/** Internal event shape before shared delivery metadata is attached. */
export type GtfsReportEventInput = GtfsReportEvent extends infer Event
  ? Event extends GtfsReportEvent
    ? Event extends { type: 'message' }
      ? Omit<Event, 'operationId' | 'timestampMs'>
      : Event extends { type: 'progress' | 'status' }
        ? Omit<Event, 'level' | 'operationId' | 'timestampMs'>
        : Omit<Event, 'level' | 'message' | 'operationId' | 'timestampMs'>
    : never
  : never;

export function getEventLevel(
  event: GtfsReportEventInput,
): GtfsLogMessageLevel {
  if (event.type === 'message') {
    return event.level;
  }
  if (event.type === 'schema:recreate') {
    return 'warn';
  }
  if (event.type === 'validation:notice') {
    return event.notice.severity;
  }
  return 'info';
}

export function isLevelEnabled(
  reportingLevel: GtfsReportingLevel,
  level: GtfsLogMessageLevel,
) {
  const severity: Record<GtfsReportingLevel, number> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
  };
  return severity[reportingLevel] >= severity[level];
}
