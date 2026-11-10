import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../../diagnostics/errors.ts';

export function createGtfsExportError(
  message: string,
  options: {
    category?: GtfsErrorCategory;
    code: GtfsErrorCode;
    details?: Record<string, unknown>;
    cause?: unknown;
  },
): GtfsError {
  return new GtfsError(message, {
    code: options.code,
    category: options.category ?? GtfsErrorCategory.DATABASE,
    ...(options.details === undefined ? {} : { details: options.details }),
    ...(options.cause === undefined ? {} : { cause: options.cause }),
  });
}
