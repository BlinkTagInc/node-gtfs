import { randomUUID } from 'node:crypto';

import { getEventLevel, isLevelEnabled } from './events.ts';
import {
  formatErrorMessage,
  formatOperationComplete,
  formatOperationStart,
} from './format.ts';
import { isGtfsError } from '../diagnostics/errors.ts';
import { DEFAULT_GTFS_REPORTING_LEVELS } from '../config/defaults.ts';

import type {
  GtfsReportEvent,
  GtfsReportEventInput,
  GtfsReportedError,
  GtfsOperationName,
} from './events.ts';
import type {
  GtfsReportingLevel,
  GtfsLogMessageLevel,
  GtfsReportingConfig,
} from './types.ts';
import type { GtfsValidationNotice } from '../diagnostics/errors.ts';
import {
  copyGtfsDiagnosticPositions,
  type GtfsDiagnosticPosition,
} from '../diagnostics/position.ts';

interface ReportingState {
  readonly operationId: string;
}

const states = new WeakMap<GtfsReportingConfig, ReportingState>();

/** Starts a new event-correlation scope for one library operation. */
export function beginReportingOperation(reporting: GtfsReportingConfig): void {
  states.set(reporting, { operationId: randomUUID() });
}

function getReportingState(reporting: GtfsReportingConfig): ReportingState {
  const existing = states.get(reporting);
  if (existing) {
    return existing;
  }
  const state = { operationId: randomUUID() };
  states.set(reporting, state);
  return state;
}

function resolveReportingLevel(
  reporting: GtfsReportingConfig,
): GtfsReportingLevel {
  if (reporting.reporter === undefined) {
    return DEFAULT_GTFS_REPORTING_LEVELS.withoutReporter;
  }
  return reporting.level ?? DEFAULT_GTFS_REPORTING_LEVELS.withReporter;
}

function formatEventMessage(event: GtfsReportEventInput): string {
  switch (event.type) {
    case 'message':
    case 'progress':
    case 'status':
      return event.message;
    case 'validation:notice':
      return `${event.notice.code}: ${event.notice.message}`;
    case 'schema:recreate':
      return `Recreating ${event.tables.length} GTFS tables in ${event.databaseDescription}; existing data in those tables will be deleted`;
    case 'operation:start':
      return formatOperationStart(event);
    case 'operation:complete':
      return formatOperationComplete(event);
  }
}

function freezeValidationNotice(
  notice: GtfsValidationNotice,
): Readonly<GtfsValidationNotice> {
  return Object.freeze({
    ...notice,
    ...copyGtfsDiagnosticPositions(notice),
    ...(notice.firstPosition === undefined
      ? {}
      : { firstPosition: Object.freeze({ ...notice.firstPosition }) }),
    ...(notice.details === undefined
      ? {}
      : { details: Object.freeze({ ...notice.details }) }),
  });
}

function createReportEvent(
  reporting: GtfsReportingConfig,
  input: GtfsReportEventInput,
  level: GtfsLogMessageLevel,
): GtfsReportEvent {
  const normalized =
    input.type === 'validation:notice'
      ? { ...input, notice: freezeValidationNotice(input.notice) }
      : input.type === 'schema:recreate'
        ? { ...input, tables: Object.freeze([...input.tables]) }
        : input.type === 'operation:start' && input.sourceIds !== undefined
          ? { ...input, sourceIds: Object.freeze([...input.sourceIds]) }
          : input.type === 'operation:complete' && input.result !== undefined
            ? { ...input, result: Object.freeze({ ...input.result }) }
            : input;

  return Object.freeze({
    ...normalized,
    ...(input.type === 'message' || input.type === 'validation:notice'
      ? copyGtfsDiagnosticPositions(input)
      : {}),
    level,
    timestampMs: Date.now(),
    operationId: getReportingState(reporting).operationId,
    message: formatEventMessage(input),
  }) as GtfsReportEvent;
}

export function report(
  reporting: GtfsReportingConfig,
  event: GtfsReportEventInput,
): void {
  const level = getEventLevel(event);
  if (!isLevelEnabled(resolveReportingLevel(reporting), level)) {
    return;
  }
  reporting.reporter?.(createReportEvent(reporting, event, level));
}

function createReportedError(error: Error): GtfsReportedError {
  return Object.freeze({
    name: error.name,
    message: error.message,
    ...(isGtfsError(error)
      ? {
          code: error.code,
          ...copyGtfsDiagnosticPositions(error),
          category: error.category,
          ...(error.statusCode === undefined
            ? {}
            : { statusCode: error.statusCode }),
          ...(error.details === undefined
            ? {}
            : { details: Object.freeze({ ...error.details }) }),
        }
      : {}),
  });
}

export function log(
  reporting: GtfsReportingConfig,
  level: GtfsLogMessageLevel,
  body: string | Error,
  context: GtfsDiagnosticPosition & {
    sourceId?: string;
    filename?: string;
  } = {},
): void {
  const error = body instanceof Error ? createReportedError(body) : undefined;
  report(reporting, {
    type: 'message',
    level,
    message: typeof body === 'string' ? body : formatErrorMessage(body),
    ...(error === undefined ? {} : { error }),
    ...copyGtfsDiagnosticPositions(error ?? {}),
    ...context,
  });
}

export function validationNotice(
  reporting: GtfsReportingConfig,
  notice: GtfsValidationNotice,
  operation: Extract<GtfsOperationName, 'import' | 'realtime' | 'validation'>,
): void {
  report(reporting, {
    type: 'validation:notice',
    operation,
    notice,
    filename: notice.filename,
    ...(notice.sourceId === undefined ? {} : { sourceId: notice.sourceId }),
    ...copyGtfsDiagnosticPositions(notice),
    ...(notice.firstPosition === undefined
      ? {}
      : { firstPosition: Object.freeze({ ...notice.firstPosition }) }),
  });
}

export function progress(
  reporting: GtfsReportingConfig,
  message: string,
  context: {
    progressBar?: boolean;
    operation?: GtfsOperationName;
    sourceId?: string;
    filename?: string;
    current?: number;
    total?: number;
  } = {},
): void {
  report(reporting, {
    type: 'progress',
    message,
    ...context,
  } as GtfsReportEventInput);
}

export function status(
  reporting: GtfsReportingConfig,
  message: string,
  context: {
    progressBar?: boolean;
    phase?: 'start' | 'complete';
    heading?: boolean;
    databaseDescription?: string;
    operation?: GtfsOperationName;
    sourceId?: string;
    filename?: string;
  } = {},
): void {
  report(reporting, {
    type: 'status',
    message,
    ...context,
  } as GtfsReportEventInput);
}
