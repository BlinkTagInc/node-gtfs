import type {
  GtfsError,
  GtfsErrorCode,
  GtfsValidationNotice,
} from '../../diagnostics/errors.ts';
import {
  collectValidationNotice,
  createValidationSummary,
  freezeValidationSummary,
  type GtfsValidationSummary,
  type MutableGtfsValidationSummary,
} from '../../validation/summary.ts';

export interface GtfsImportFileResult {
  readonly filename: string;
  readonly recordsRead: number;
  readonly rowsInserted: number;
  readonly rowsSkipped: number;
}

export interface GtfsImportSourceResult {
  readonly sourceId: string;
  readonly success: boolean;
  readonly durationMs: number;
  readonly files: readonly GtfsImportFileResult[];
  readonly error?: GtfsError;
}

export interface GtfsImportResult {
  readonly errors: readonly GtfsError[];
  readonly errorCountsByCode: Readonly<Partial<Record<GtfsErrorCode, number>>>;
  readonly validation: GtfsValidationSummary;
  readonly sources: readonly GtfsImportSourceResult[];
  readonly durationMs: number;
  readonly success: boolean;
}

/** Internal accumulator used while an import operation is in progress. */
export interface MutableGtfsImportResult {
  errors: GtfsError[];
  errorCountsByCode: Partial<Record<GtfsErrorCode, number>>;
  validation: MutableGtfsValidationSummary;
  sources: MutableGtfsImportSourceResult[];
  success: boolean;
}

type MutableGtfsImportFileResult = {
  -readonly [Key in keyof GtfsImportFileResult]: GtfsImportFileResult[Key];
};

export interface MutableGtfsImportSourceResult {
  sourceId: string;
  success: boolean;
  durationMs: number;
  files: MutableGtfsImportFileResult[];
  error?: GtfsError;
}

export function createGtfsImportSourceResult(
  sourceId: string,
): MutableGtfsImportSourceResult {
  return { sourceId, success: false, durationMs: 0, files: [] };
}

export function getImportFileResult(
  source: MutableGtfsImportSourceResult,
  filename: string,
): MutableGtfsImportFileResult {
  let file = source.files.find((item) => item.filename === filename);
  if (file === undefined) {
    file = { filename, recordsRead: 0, rowsInserted: 0, rowsSkipped: 0 };
    source.files.push(file);
  }
  return file;
}

export function finishGtfsImportResult(
  result: MutableGtfsImportResult,
  durationMs: number,
): GtfsImportResult {
  return Object.freeze({
    success: result.success,
    durationMs,
    errors: Object.freeze([...result.errors]),
    errorCountsByCode: Object.freeze({ ...result.errorCountsByCode }),
    validation: freezeValidationSummary(result.validation),
    sources: Object.freeze(
      result.sources.map((source) =>
        Object.freeze({
          ...source,
          files: Object.freeze(
            source.files.map((file) => Object.freeze({ ...file })),
          ),
        }),
      ),
    ),
  });
}

export function createGtfsImportResult(): MutableGtfsImportResult {
  return {
    errors: [],
    errorCountsByCode: {},
    validation: createValidationSummary(),
    sources: [],
    success: true,
  };
}

export function addValidationNotice(
  result: MutableGtfsImportResult,
  notice: GtfsValidationNotice,
): void {
  collectValidationNotice(result.validation, notice);
}

export function addImportError(
  result: MutableGtfsImportResult,
  error: GtfsError,
): void {
  result.errors.push(error);
  result.success = false;
  result.errorCountsByCode[error.code] =
    (result.errorCountsByCode[error.code] ?? 0) + 1;
}
