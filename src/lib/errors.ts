export enum GtfsErrorCategory {
  CONFIG = 'config',
  DOWNLOAD = 'download',
  ZIP = 'zip',
  VALIDATION = 'validation',
  DATABASE = 'database',
  PARSE = 'parse',
  QUERY = 'query',
  INTERNAL = 'internal',
}

/**
 * Error codes are a public API contract and must remain stable across
 * minor/patch releases.
 */
export enum GtfsErrorCode {
  GTFS_DOWNLOAD_HTTP = 'GTFS_DOWNLOAD_HTTP',
  GTFS_DOWNLOAD_FAILED = 'GTFS_DOWNLOAD_FAILED',
  GTFS_ZIP_INVALID = 'GTFS_ZIP_INVALID',
  GTFS_REQUIRED_FIELD_MISSING = 'GTFS_REQUIRED_FIELD_MISSING',
  GTFS_INVALID_DATE = 'GTFS_INVALID_DATE',
  GTFS_CONFIG_INVALID = 'GTFS_CONFIG_INVALID',
  DB_OPEN_FAILED = 'DB_OPEN_FAILED',
  GTFS_DB_OPERATION_FAILED = 'GTFS_DB_OPERATION_FAILED',
  GTFS_JSON_INVALID = 'GTFS_JSON_INVALID',
  GTFS_UNSUPPORTED_FILE_TYPE = 'GTFS_UNSUPPORTED_FILE_TYPE',
  GTFS_CSV_PARSE_FAILED = 'GTFS_CSV_PARSE_FAILED',
  GTFS_QUERY_INVALID = 'GTFS_QUERY_INVALID',
}

export enum GtfsWarningCode {
  GTFS_DUPLICATE_PRIMARY_KEY = 'GTFS_DUPLICATE_PRIMARY_KEY',
}

export interface GtfsWarning {
  code: GtfsWarningCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ImportReport {
  errors: GtfsError[];
  warnings: GtfsWarning[];
  errorCountsByCode: Partial<Record<GtfsErrorCode, number>>;
  warningCountsByCode: Partial<Record<GtfsWarningCode, number>>;
}

interface GtfsErrorOptions {
  code: GtfsErrorCode;
  category: GtfsErrorCategory;
  isOperational?: boolean;
  statusCode?: number;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class GtfsError extends Error {
  code: GtfsErrorCode;
  category: GtfsErrorCategory;
  isOperational: boolean;
  statusCode?: number;
  details?: Record<string, unknown>;

  constructor(message: string, options: GtfsErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'GtfsError';
    this.code = options.code;
    this.category = options.category;
    this.isOperational = options.isOperational ?? true;
    this.statusCode = options.statusCode;
    this.details = options.details;
  }
}

export function isGtfsError(error: unknown): error is GtfsError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as Partial<GtfsError> & { name?: unknown };
  return (
    candidate.name === 'GtfsError' &&
    typeof candidate.message === 'string' &&
    typeof candidate.code === 'string' &&
    typeof candidate.category === 'string' &&
    typeof candidate.isOperational === 'boolean'
  );
}

export function isGtfsValidationError(error: unknown): error is GtfsError {
  return isGtfsError(error) && error.category === GtfsErrorCategory.VALIDATION;
}

export function toGtfsError(
  error: unknown,
  fallback: Omit<GtfsErrorOptions, 'cause'> & { message: string },
): GtfsError {
  if (isGtfsError(error)) {
    return error;
  }

  return new GtfsError(fallback.message, {
    ...fallback,
    cause: error,
  });
}

export function createImportReport(): ImportReport {
  return {
    errors: [],
    warnings: [],
    errorCountsByCode: {},
    warningCountsByCode: {},
  };
}

export function addImportError(report: ImportReport, error: GtfsError): void {
  report.errors.push(error);
  report.errorCountsByCode[error.code] =
    (report.errorCountsByCode[error.code] ?? 0) + 1;
}

export function addImportWarning(
  report: ImportReport,
  warning: GtfsWarning,
): void {
  report.warnings.push(warning);
  report.warningCountsByCode[warning.code] =
    (report.warningCountsByCode[warning.code] ?? 0) + 1;
}

export function formatGtfsError(
  error: unknown,
  options: { verbosity: 'user' | 'developer' } = { verbosity: 'developer' },
) {
  if (!isGtfsError(error)) {
    const message = error instanceof Error ? error.message : String(error);
    return options.verbosity === 'user' ? message : `UNKNOWN_ERROR: ${message}`;
  }

  if (options.verbosity === 'user') {
    return error.message;
  }

  return [
    `${error.code}: ${error.message}`,
    `category=${error.category}`,
    error.statusCode !== undefined ? `statusCode=${error.statusCode}` : null,
    error.details ? `details=${JSON.stringify(error.details)}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}
