import * as colors from 'yoctocolors';

import { formatGtfsError, isGtfsError } from '../diagnostics/errors.ts';

import type { GtfsOperationName, GtfsReportEvent } from './events.ts';

type ErrorAudience = 'user' | 'developer';

const OPERATION_LABEL: Record<GtfsOperationName, string> = {
  cleanup: 'GTFS-Realtime cleanup',
  import: 'GTFS import',
  export: 'GTFS export',
  realtime: 'GTFS-Realtime refresh',
  validation: 'GTFS validation',
};

export function inferErrorAudience(error: unknown): ErrorAudience {
  return isGtfsError(error) ? 'user' : 'developer';
}

export function formatErrorMessage(
  error: unknown,
  options: { audience?: ErrorAudience } = {},
) {
  const audience = options.audience ?? inferErrorAudience(error);

  if (isGtfsError(error)) {
    return `[GTFS] ${formatGtfsError(error, { audience })}`;
  }

  return error instanceof Error ? error.message : String(error);
}

export function formatError(
  error: unknown,
  options: { audience?: ErrorAudience } = {},
) {
  const message = formatErrorMessage(error, options).replace(/^Error: /u, '');
  return `${colors.red('Error:')} ${message}`;
}

export function formatWarning(text: string) {
  return `${colors.yellow('Warning:')} ${text}`;
}

export function formatStackTrace(error: unknown): string {
  return error instanceof Error && error.stack ? colors.dim(error.stack) : '';
}

// Matches common credential fragments in query parameter names.
const SENSITIVE_PARAMETER_FRAGMENTS = [
  'key',
  'secret',
  'token',
  'password',
  'passwd',
  'passphrase',
  'pwd',
  'credential',
  'auth',
  'signature',
  'session',
];

// Match ambiguous or abbreviated names exactly: "sig" must not hide
// "signal" or "assigned_stop_id", and "code" must not hide "stop_code".
const SENSITIVE_PARAMETER_NAMES = new Set([
  'sig',
  'hmac',
  'jwt',
  'bearer',
  'policy',
  'googleaccessid',
  'code',
  'assertion',
  'ticket',
  'samlrequest',
  'samlresponse',
  'hdnts',
  'hdntl',
]);

function isSensitiveParameter(name: string) {
  const lowered = name.toLowerCase();

  return (
    SENSITIVE_PARAMETER_NAMES.has(lowered) ||
    SENSITIVE_PARAMETER_FRAGMENTS.some((fragment) => lowered.includes(fragment))
  );
}

export function redactUrlForReporting(url: string): string {
  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const parameters = new URLSearchParams();
  for (const [name, value] of parsed.searchParams) {
    parameters.append(name, isSensitiveParameter(name) ? '***' : value);
  }

  const query = parameters.toString().replaceAll('%2A%2A%2A', '***');

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

export function formatOperationStart(
  event: Pick<
    Extract<GtfsReportEvent, { type: 'operation:start' }>,
    'databaseDescription' | 'operation' | 'sourceCount'
  >,
) {
  const sources =
    event.sourceCount === undefined
      ? ''
      : ` for ${pluralize('source', 'sources', event.sourceCount)}`;
  return `Starting ${OPERATION_LABEL[event.operation]}${sources}${event.databaseDescription === undefined ? '' : ` using ${event.databaseDescription}`}`;
}

export function formatOperationComplete(
  event: Pick<
    Extract<GtfsReportEvent, { type: 'operation:complete' }>,
    'destination' | 'durationMs' | 'operation' | 'summary'
  >,
) {
  const duration = `${(event.durationMs / 1000).toFixed(1)} seconds`;
  const what =
    event.destination === undefined
      ? OPERATION_LABEL[event.operation]
      : `${OPERATION_LABEL[event.operation]} to ${event.destination}`;

  return event.summary === undefined
    ? `Completed ${what} in ${duration}`
    : `Completed ${what}: ${event.summary}, ${duration}`;
}

// Fixed width prevents live progress output from shifting between files.
const FILENAME_WIDTH = 24;

const COUNT_WIDTH = 11;

export function formatFileCount(filename: string, count: number) {
  return `  ${filename.padEnd(FILENAME_WIDTH)}  ${formatCount(count).padStart(COUNT_WIDTH)}`;
}

export function formatFileList(label: string, filenames: readonly string[]) {
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
