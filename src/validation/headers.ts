import type { FileBackedCompiledGtfsTable } from '../schema/table-registry.ts';
import { GTFS_UNKNOWN_FIELDS_COLUMN } from '../schema/compile-table.ts';
import {
  GtfsValidationNoticeCode,
  type GtfsValidationNotice,
} from '../diagnostics/errors.ts';
import { createValidationNotice } from './notice.ts';
import type {
  ParsedGtfsSourceFile,
  ValidateGtfsSourceOptions,
} from './types.ts';

export function validateGtfsHeaders({
  options,
  table,
  source,
}: {
  options: ValidateGtfsSourceOptions;
  table: FileBackedCompiledGtfsTable;
  source: ParsedGtfsSourceFile;
}): readonly GtfsValidationNotice[] {
  if (options.mode === 'off' && options.onUnknownField === 'preserve') {
    return [];
  }
  const notices: GtfsValidationNotice[] = [];
  const knownHeaders = new Set(table.columns.map((column) => column.name));
  const headerSet = new Set(source.headers);

  for (const column of table.columns) {
    if (
      options.mode !== 'off' &&
      column.presence === 'required' &&
      !headerSet.has(column.name)
    ) {
      notices.push(
        createValidationNotice(options, {
          code: GtfsValidationNoticeCode.REQUIRED_HEADER_MISSING,
          severity: 'error',
          message: `${table.filename} is missing required header ${JSON.stringify(column.name)}`,
          filename: table.filename,
          field: column.name,
        }),
      );
    }
  }

  for (const header of source.headers) {
    if (knownHeaders.has(header)) {
      continue;
    }
    notices.push(
      createValidationNotice(options, {
        code: GtfsValidationNoticeCode.UNKNOWN_FIELD,
        severity: options.onUnknownField === 'reject' ? 'error' : 'warn',
        message:
          options.onUnknownField === 'preserve'
            ? `Unknown field ${JSON.stringify(header)} in ${table.filename} will be preserved as JSON in ${table.tableName}.${GTFS_UNKNOWN_FIELDS_COLUMN}`
            : `Unknown field ${JSON.stringify(header)} in ${table.filename} will be ${options.onUnknownField === 'discard' ? 'discarded' : 'rejected'}`,
        filename: table.filename,
        field: header,
      }),
    );
  }

  return notices;
}
