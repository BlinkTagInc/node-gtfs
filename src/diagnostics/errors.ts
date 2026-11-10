import type {
  GtfsErrorDetails,
  GtfsValidationNoticeDetails,
} from '../types/diagnostics.ts';
import {
  copyGtfsDiagnosticPositions,
  type GtfsDiagnosticPosition,
  type GtfsSourcePosition,
} from './position.ts';

export const GtfsErrorCategory = {
  CONFIG: 'config',
  DOWNLOAD: 'download',
  ZIP: 'zip',
  VALIDATION: 'validation',
  SOURCE: 'source',
  EXPORT: 'export',
  DATABASE: 'database',
  PARSE: 'parse',
  QUERY: 'query',
  INTERNAL: 'internal',
  CANCELLATION: 'cancellation',
} as const;

export type GtfsErrorCategory =
  (typeof GtfsErrorCategory)[keyof typeof GtfsErrorCategory];

/**
 * Error codes are a public API contract and must remain stable across
 * minor/patch releases.
 */
export const GtfsErrorCode = {
  OPERATION_CANCELLED: 'GTFS_OPERATION_CANCELLED',
  DOWNLOAD_HTTP_FAILED: 'GTFS_DOWNLOAD_HTTP_FAILED',
  DOWNLOAD_FAILED: 'GTFS_DOWNLOAD_FAILED',
  DOWNLOAD_REDIRECT_REJECTED: 'GTFS_DOWNLOAD_REDIRECT_REJECTED',
  DOWNLOAD_TOO_LARGE: 'GTFS_DOWNLOAD_TOO_LARGE',
  REALTIME_PROTOBUF_INVALID: 'GTFS_REALTIME_PROTOBUF_INVALID',
  ZIP_INVALID: 'GTFS_ZIP_INVALID',
  ZIP_LIMIT_EXCEEDED: 'GTFS_ZIP_LIMIT_EXCEEDED',
  REQUIRED_VALUE_MISSING: 'GTFS_REQUIRED_VALUE_MISSING',
  INVALID_DATE: 'GTFS_INVALID_DATE',
  INVALID_VALUE: 'GTFS_INVALID_VALUE',
  VALIDATION_FAILED: 'GTFS_VALIDATION_FAILED',
  REALTIME_FEED_TYPE_MISMATCH: 'GTFS_REALTIME_FEED_TYPE_MISMATCH',
  REALTIME_SCHEDULE_CHANGED: 'GTFS_REALTIME_SCHEDULE_CHANGED',
  CONFIG_INVALID: 'GTFS_CONFIG_INVALID',
  CONFIG_FILE_NOT_FOUND: 'GTFS_CONFIG_FILE_NOT_FOUND',
  CONFIG_PARSE_FAILED: 'GTFS_CONFIG_PARSE_FAILED',
  DATABASE_OPEN_FAILED: 'GTFS_DATABASE_OPEN_FAILED',
  DATABASE_OPERATION_FAILED: 'GTFS_DATABASE_OPERATION_FAILED',
  DATABASE_NOT_FOUND: 'GTFS_DATABASE_NOT_FOUND',
  DATABASE_SOURCE_EXISTS: 'GTFS_DATABASE_SOURCE_EXISTS',
  DATABASE_SOURCE_NOT_FOUND: 'GTFS_DATABASE_SOURCE_NOT_FOUND',
  SCHEMA_INVALID: 'GTFS_SCHEMA_INVALID',
  EXTENSION_DISABLED: 'GTFS_EXTENSION_DISABLED',
  JSON_INVALID: 'GTFS_JSON_INVALID',
  UNSUPPORTED_FILE_TYPE: 'GTFS_UNSUPPORTED_FILE_TYPE',
  CSV_PARSE_FAILED: 'GTFS_CSV_PARSE_FAILED',
  QUERY_INVALID: 'GTFS_QUERY_INVALID',
  INSTANCE_CLOSED: 'GTFS_INSTANCE_CLOSED',
  SOURCE_READ_FAILED: 'GTFS_SOURCE_READ_FAILED',
  EXPORT_WRITE_FAILED: 'GTFS_EXPORT_WRITE_FAILED',
  EXPORT_OUTPUT_EXISTS: 'GTFS_EXPORT_OUTPUT_EXISTS',
} as const;

export type GtfsErrorCode = (typeof GtfsErrorCode)[keyof typeof GtfsErrorCode];

const gtfsErrorCategories = {
  [GtfsErrorCode.OPERATION_CANCELLED]: GtfsErrorCategory.CANCELLATION,
  [GtfsErrorCode.DOWNLOAD_HTTP_FAILED]: GtfsErrorCategory.DOWNLOAD,
  [GtfsErrorCode.DOWNLOAD_FAILED]: GtfsErrorCategory.DOWNLOAD,
  [GtfsErrorCode.DOWNLOAD_REDIRECT_REJECTED]: GtfsErrorCategory.DOWNLOAD,
  [GtfsErrorCode.DOWNLOAD_TOO_LARGE]: GtfsErrorCategory.DOWNLOAD,
  [GtfsErrorCode.REALTIME_PROTOBUF_INVALID]: GtfsErrorCategory.PARSE,
  [GtfsErrorCode.ZIP_INVALID]: GtfsErrorCategory.ZIP,
  [GtfsErrorCode.ZIP_LIMIT_EXCEEDED]: GtfsErrorCategory.ZIP,
  [GtfsErrorCode.REQUIRED_VALUE_MISSING]: GtfsErrorCategory.VALIDATION,
  [GtfsErrorCode.INVALID_DATE]: GtfsErrorCategory.VALIDATION,
  [GtfsErrorCode.INVALID_VALUE]: GtfsErrorCategory.VALIDATION,
  [GtfsErrorCode.VALIDATION_FAILED]: GtfsErrorCategory.VALIDATION,
  [GtfsErrorCode.REALTIME_FEED_TYPE_MISMATCH]: GtfsErrorCategory.VALIDATION,
  [GtfsErrorCode.REALTIME_SCHEDULE_CHANGED]: GtfsErrorCategory.DATABASE,
  [GtfsErrorCode.CONFIG_INVALID]: GtfsErrorCategory.CONFIG,
  [GtfsErrorCode.CONFIG_FILE_NOT_FOUND]: GtfsErrorCategory.CONFIG,
  [GtfsErrorCode.CONFIG_PARSE_FAILED]: GtfsErrorCategory.CONFIG,
  [GtfsErrorCode.DATABASE_OPEN_FAILED]: GtfsErrorCategory.DATABASE,
  [GtfsErrorCode.DATABASE_OPERATION_FAILED]: GtfsErrorCategory.DATABASE,
  [GtfsErrorCode.DATABASE_NOT_FOUND]: GtfsErrorCategory.DATABASE,
  [GtfsErrorCode.DATABASE_SOURCE_EXISTS]: GtfsErrorCategory.DATABASE,
  [GtfsErrorCode.DATABASE_SOURCE_NOT_FOUND]: GtfsErrorCategory.DATABASE,
  [GtfsErrorCode.SCHEMA_INVALID]: GtfsErrorCategory.DATABASE,
  [GtfsErrorCode.EXTENSION_DISABLED]: GtfsErrorCategory.QUERY,
  [GtfsErrorCode.JSON_INVALID]: GtfsErrorCategory.PARSE,
  [GtfsErrorCode.UNSUPPORTED_FILE_TYPE]: GtfsErrorCategory.PARSE,
  [GtfsErrorCode.CSV_PARSE_FAILED]: GtfsErrorCategory.PARSE,
  [GtfsErrorCode.QUERY_INVALID]: GtfsErrorCategory.QUERY,
  [GtfsErrorCode.INSTANCE_CLOSED]: GtfsErrorCategory.DATABASE,
  [GtfsErrorCode.SOURCE_READ_FAILED]: GtfsErrorCategory.SOURCE,
  [GtfsErrorCode.EXPORT_WRITE_FAILED]: GtfsErrorCategory.EXPORT,
  [GtfsErrorCode.EXPORT_OUTPUT_EXISTS]: GtfsErrorCategory.EXPORT,
} as const satisfies Readonly<Record<GtfsErrorCode, GtfsErrorCategory>>;

export const GtfsValidationNoticeCode = {
  REQUIRED_FILE_MISSING: 'GTFS_REQUIRED_FILE_MISSING',
  REQUIRED_HEADER_MISSING: 'GTFS_REQUIRED_HEADER_MISSING',
  REQUIRED_VALUE_MISSING: 'GTFS_REQUIRED_VALUE_MISSING',
  UNKNOWN_FIELD: 'GTFS_UNKNOWN_FIELD',
  EXTENSION_DISABLED: 'GTFS_EXTENSION_DISABLED',
  INVALID_VALUE: 'GTFS_VALIDATION_INVALID_VALUE',
  RANGE: 'GTFS_VALIDATION_RANGE',
  CONDITIONAL_PRESENCE: 'GTFS_CONDITIONAL_PRESENCE',
  DUPLICATE_PRIMARY_KEY: 'GTFS_DUPLICATE_PRIMARY_KEY',
  REFERENCE_NOT_FOUND: 'GTFS_REFERENCE_NOT_FOUND',
  REALTIME_ENTITY_ID_MISSING: 'GTFS_REALTIME_ENTITY_ID_MISSING',
  REALTIME_ENTITY_UNSUPPORTED: 'GTFS_REALTIME_ENTITY_UNSUPPORTED',
  REALTIME_ENTITY_TYPE_AMBIGUOUS: 'GTFS_REALTIME_ENTITY_TYPE_AMBIGUOUS',
  REALTIME_FEED_TYPE_MISMATCH: 'GTFS_REALTIME_FEED_TYPE_MISMATCH',
  REALTIME_ALERT_PERIOD_INVALID: 'GTFS_REALTIME_ALERT_PERIOD_INVALID',
  REALTIME_ALERT_IMPACT_NOT_CONTAINED:
    'GTFS_REALTIME_ALERT_IMPACT_NOT_CONTAINED',
  REALTIME_INCREMENTALITY_UNSUPPORTED:
    'GTFS_REALTIME_INCREMENTALITY_UNSUPPORTED',
  REALTIME_TOMBSTONE_AMBIGUOUS: 'GTFS_REALTIME_TOMBSTONE_AMBIGUOUS',
  REALTIME_TOMBSTONE_IN_FULL_DATASET: 'GTFS_REALTIME_TOMBSTONE_IN_FULL_DATASET',
} as const;

export type GtfsValidationNoticeCode =
  (typeof GtfsValidationNoticeCode)[keyof typeof GtfsValidationNoticeCode];

export type GtfsValidationSeverity = 'error' | 'warn' | 'info';

export interface GtfsValidationNotice {
  readonly code: GtfsValidationNoticeCode;
  readonly severity: GtfsValidationSeverity;
  readonly message: string;
  readonly filename: string;
  readonly sourceId?: string;
  readonly position?: GtfsSourcePosition;
  /** Original record when this notice identifies a duplicate. */
  readonly firstPosition?: GtfsSourcePosition;
  readonly field?: string;
  readonly details?: GtfsValidationNoticeDetails;
}

interface GtfsErrorOptions extends GtfsDiagnosticPosition {
  readonly code: GtfsErrorCode;
  readonly category?: GtfsErrorCategory;
  readonly isOperational?: boolean;
  readonly statusCode?: number;
  readonly details?: GtfsErrorDetails;
  readonly cause?: unknown;
}

export class GtfsError extends Error {
  code: GtfsErrorCode;
  category: GtfsErrorCategory;
  isOperational: boolean;
  statusCode?: number;
  details?: GtfsErrorDetails;
  declare position?: GtfsSourcePosition;
  declare positions?: readonly GtfsSourcePosition[];

  constructor(message: string, options: GtfsErrorOptions) {
    super(message, { cause: options.cause });
    const category = gtfsErrorCategories[options.code];
    if (options.category !== undefined && options.category !== category) {
      throw new TypeError(
        `Error code ${options.code} belongs to category ${category}, not ${options.category}`,
      );
    }
    this.name = 'GtfsError';
    this.code = options.code;
    this.category = category;
    this.isOperational = options.isOperational ?? true;
    if (options.statusCode !== undefined) {
      this.statusCode = options.statusCode;
    }
    if (options.details !== undefined) {
      this.details = options.details;
    }
    Object.assign(this, copyGtfsDiagnosticPositions(options));
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

export function createGtfsQueryError(
  message: string,
  details?: GtfsErrorDetails,
  cause?: unknown,
): GtfsError {
  return new GtfsError(message, {
    code: GtfsErrorCode.QUERY_INVALID,
    category: GtfsErrorCategory.QUERY,
    ...(details === undefined ? {} : { details }),
    ...(cause === undefined ? {} : { cause }),
  });
}

export function createGtfsConfigError(
  message: string,
  details?: GtfsErrorDetails,
): GtfsError {
  return new GtfsError(message, {
    code: GtfsErrorCode.CONFIG_INVALID,
    category: GtfsErrorCategory.CONFIG,
    ...(details === undefined ? {} : { details }),
  });
}

export function toGtfsError(
  error: unknown,
  fallback: Readonly<
    Omit<GtfsErrorOptions, 'cause'> & { readonly message: string }
  >,
): GtfsError {
  if (isGtfsError(error)) {
    // Add context without replacing public error metadata.
    if (fallback.details) {
      error.details = { ...fallback.details, ...error.details };
    }
    if (error.position === undefined && error.positions === undefined) {
      Object.assign(error, copyGtfsDiagnosticPositions(fallback));
    }
    return error;
  }

  return new GtfsError(fallback.message, {
    ...fallback,
    cause: error,
  });
}

export function formatGtfsError(
  error: unknown,
  options: Readonly<{ audience: 'user' | 'developer' }> = {
    audience: 'developer',
  },
) {
  if ('verbosity' in options) {
    throw new GtfsError(
      '`formatGtfsError()` option `verbosity` was removed; use `audience`',
      {
        code: GtfsErrorCode.CONFIG_INVALID,
        category: GtfsErrorCategory.CONFIG,
        details: {
          legacyPath: 'verbosity',
          replacementPath: 'audience',
        },
      },
    );
  }
  if (!isGtfsError(error)) {
    const message = error instanceof Error ? error.message : String(error);
    return options.audience === 'user' ? message : `UNKNOWN_ERROR: ${message}`;
  }

  if (options.audience === 'user') {
    return error.message;
  }

  return [
    `${error.code}: ${error.message}`,
    `category=${error.category}`,
    error.statusCode !== undefined ? `statusCode=${error.statusCode}` : null,
    error.position === undefined
      ? null
      : `position=${JSON.stringify(error.position)}`,
    error.positions === undefined
      ? null
      : `positions=${JSON.stringify(error.positions)}`,
    error.details ? `details=${serializeErrorDetails(error.details)}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}

function serializeErrorDetails(details: GtfsErrorDetails): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(details, (_key, value: unknown) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (value !== null && typeof value === 'object') {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  } catch {
    return '[Unserializable details]';
  }
}
