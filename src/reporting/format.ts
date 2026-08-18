import * as colors from 'yoctocolors';

import { formatGtfsError, isGtfsError } from '../lib/errors.ts';

import type { ReportEvent, TaskName } from './events.ts';

export type ErrorVerbosity = 'user' | 'developer';

const TASK_LABEL: Record<TaskName, string> = {
  import: 'GTFS import',
  export: 'GTFS export',
  realtime: 'GTFS-Realtime refresh',
};

export function errorVerbosity(error: unknown): ErrorVerbosity {
  return isGtfsError(error) ? 'user' : 'developer';
}

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

export function formatError(
  error: unknown,
  options: { verbosity?: ErrorVerbosity } = {},
) {
  const message = formatErrorMessage(error, options).replace('Error: ', '');
  return colors.red(`${colors.underline('Error')}: ${message}`);
}

export function formatWarning(text: string) {
  return colors.yellow(`${colors.underline('Warning')}: ${text}`);
}

export function formatStackTrace(error: unknown): string {
  return error instanceof Error && error.stack ? colors.dim(error.stack) : '';
}

// Matches common credential fragments in query parameter names.
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

export function formatUrl(url: string): string {
  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  // Updating URLSearchParams while iterating can skip entries.
  const keys = Array.from(parsed.searchParams.keys());

  for (const key of keys) {
    if (isSensitiveParameter(key)) {
      parsed.searchParams.set(key, '***');
    }
  }

  const query = parsed.searchParams.toString().replaceAll('%2A%2A%2A', '***');

  return `${parsed.origin}${parsed.pathname}${query === '' ? '' : `?${query}`}`;
}

export function formatCount(count: number): string {
  return count.toLocaleString('en-US');
}

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

export function pluralize(singular: string, plural: string, count: number) {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

export function formatRunStart(
  event: Extract<ReportEvent, { type: 'run:start' }>,
) {
  const databaseDescription =
    event.databaseDescription ?? `SQLite database at ${event.sqlitePath}`;
  return `Starting ${TASK_LABEL[event.task]} for ${pluralize('agency', 'agencies', event.agencyCount)} using ${databaseDescription}`;
}

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

// Fixed width prevents live progress output from shifting between files.
const FILENAME_WIDTH = 24;

const COUNT_WIDTH = 11;

export function formatFileCount(filename: string, count: number) {
  return `  ${filename.padEnd(FILENAME_WIDTH)}  ${formatCount(count).padStart(COUNT_WIDTH)}`;
}

export function formatFileNote(filename: string, note: string) {
  return `  ${filename.padEnd(FILENAME_WIDTH)}  ${note.padStart(COUNT_WIDTH)}`;
}

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
