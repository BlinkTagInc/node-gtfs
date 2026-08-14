import * as colors from 'yoctocolors';

import { formatGtfsError, isGtfsError } from '../lib/errors.ts';

import type { ReportEvent, TaskName } from './events.ts';

export type ErrorVerbosity = 'user' | 'developer';

/* What each task is called in the lines describing it. */
const TASK_LABEL: Record<TaskName, string> = {
  import: 'GTFS import',
  export: 'GTFS export',
  realtime: 'GTFS-Realtime refresh',
};

/*
 * A node-gtfs error was written to be read by whoever ran the tool, so it is
 * shown as written. Anything else escaped from somewhere it shouldn't have,
 * and the developer rendering keeps every detail it carries.
 */
export function errorVerbosity(error: unknown): ErrorVerbosity {
  return isGtfsError(error) ? 'user' : 'developer';
}

/*
 * The text of an error, including the code and category a structured error
 * carries. No color and no label, so it is also what gets handed to a
 * `logFunction` writing somewhere that isn't a terminal.
 */
export function formatErrorMessage(
  error: unknown,
  options: { verbosity?: ErrorVerbosity } = {},
) {
  const verbosity = options.verbosity ?? errorVerbosity(error);

  if (isGtfsError(error)) {
    return `[GTFS] ${formatGtfsError(error, { verbosity })}`;
  }

  return error instanceof Error ? error.message : String(error);
}

/*
 * Format an error for the console.
 */
export function formatError(
  error: unknown,
  options: { verbosity?: ErrorVerbosity } = {},
) {
  const message = formatErrorMessage(error, options).replace('Error: ', '');
  return colors.red(`${colors.underline('Error')}: ${message}`);
}

/*
 * Format a warning for the console.
 */
export function formatWarning(text: string) {
  return colors.yellow(`${colors.underline('Warning')}: ${text}`);
}

/*
 * Format an error's stack trace for the console. Empty for anything that isn't
 * an `Error` or has no stack.
 */
export function formatStackTrace(error: unknown): string {
  return error instanceof Error && error.stack ? colors.dim(error.stack) : '';
}

/*
 * `count` of `singular`, pluralized. Kept here with the other text so a run
 * reads the same however it is being watched.
 */
export function pluralize(singular: string, plural: string, count: number) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/*
 * The lines describing a run. Shared by every reporter so that a run reads the
 * same however it is being watched.
 */
export function formatRunStart(
  event: Extract<ReportEvent, { type: 'run:start' }>,
) {
  return `Starting ${TASK_LABEL[event.task]} for ${pluralize('agency', 'agencies', event.agencyCount)} using SQLite database at ${event.sqlitePath}`;
}

export function formatRunComplete(
  event: Extract<ReportEvent, { type: 'run:complete' }>,
) {
  return event.summary
    ? `Completed ${TASK_LABEL[event.task]}: ${event.summary}`
    : `Completed ${TASK_LABEL[event.task]}`;
}

export function formatRunDuration(
  event: Extract<ReportEvent, { type: 'run:complete' }>,
) {
  return `${TASK_LABEL[event.task]} required ${event.elapsedSeconds.toFixed(1)} seconds`;
}
