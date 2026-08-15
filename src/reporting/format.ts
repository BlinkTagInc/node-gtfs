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
 * Fragments that mark a query parameter as carrying a credential. Matched
 * anywhere in the name and case-insensitively, so `api_key`, `apiKey`,
 * `subscription-key` and `X-Api-Token` are all covered by two entries.
 */
const SENSITIVE_PARAMETERS = [
  'key',
  'secret',
  'token',
  'password',
  'passwd',
  'pwd',
  'credential',
  'auth',
  'signature',
  'session',
];

function isSensitiveParameter(name: string) {
  const lowered = name.toLowerCase();

  return SENSITIVE_PARAMETERS.some((fragment) => lowered.includes(fragment));
}

/*
 * A url as it is safe to print.
 */
export function formatUrl(url: string): string {
  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    // Not a url node can parse: show it unchanged rather than guess at it.
    return url;
  }

  // Snapshot the names first: setting a value while iterating mutates them.
  const keys = Array.from(parsed.searchParams.keys());

  for (const key of keys) {
    if (isSensitiveParameter(key)) {
      parsed.searchParams.set(key, '***');
    }
  }

  const query = parsed.searchParams.toString().replaceAll('%2A%2A%2A', '***');

  return `${parsed.origin}${parsed.pathname}${query === '' ? '' : `?${query}`}`;
}

/*
 * A row count with thousands separators.
 */
export function formatCount(count: number): string {
  return count.toLocaleString('en-US');
}

/*
 * A byte count in whichever unit keeps it short.
 */
export function formatBytes(bytes: number): string {
  const units = ['bytes', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

/*
 * `count` of `singular`, pluralized. Kept here with the other text so a run
 * reads the same however it is being watched.
 */
export function pluralize(singular: string, plural: string, count: number) {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
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

/*
 * What finished, what it produced, and how long it took.
 */
export function formatRunComplete(
  event: Extract<ReportEvent, { type: 'run:complete' }>,
) {
  const seconds = `${event.elapsedSeconds.toFixed(1)} seconds`;
  const what =
    event.destination === undefined
      ? TASK_LABEL[event.task]
      : `${TASK_LABEL[event.task]} to ${event.destination}`;

  return event.summary === undefined
    ? `Completed ${what} in ${seconds}`
    : `Completed ${what}: ${event.summary}, ${seconds}`;
}

/*
 * Width of the filename column. Fixed rather than measured, so every count
 * lands in the same place while a run is still going rather than only once
 * the widest name is known. It fits the longest standard GTFS filename; a
 * non-standard or extension file with a longer name overflows its own column
 * rather than widening every line of every run.
 */
export const FILENAME_WIDTH = 24;

/* The count column, wide enough for a large agency's `stop_times.txt`. */
const COUNT_WIDTH = 11;

/* One row of the file/count column: `  stop_times.txt      1,901,119`. */
export function formatFileCount(filename: string, count: number) {
  return `  ${filename.padEnd(FILENAME_WIDTH)}  ${formatCount(count).padStart(COUNT_WIDTH)}`;
}

/* The same shape, for a file that has no count to show. */
export function formatFileNote(filename: string, note: string) {
  return `  ${filename.padEnd(FILENAME_WIDTH)}  ${note.padStart(COUNT_WIDTH)}`;
}

/*
 * A labelled list of filenames, wrapped with a hanging indent. A feed is
 * typically missing twenty of these, and a terminal would otherwise fold them
 * at an arbitrary point mid-name.
 */
export function formatFileList(label: string, filenames: string[]) {
  const prefix = `  ${label} (${filenames.length}): `;
  const lines: string[] = [];
  let line = prefix;

  for (const [index, filename] of filenames.entries()) {
    const piece = index === filenames.length - 1 ? filename : `${filename}, `;

    if (line.length + piece.trimEnd().length > 78 && line !== prefix) {
      lines.push(line.trimEnd());
      line = ' '.repeat(prefix.length);
    }

    line += piece;
  }

  lines.push(line.trimEnd());

  return lines.join('\n');
}
