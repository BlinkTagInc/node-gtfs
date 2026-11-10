import type { CompiledGtfsTable } from '../schema/compile-table.ts';
import type { FileBackedCompiledGtfsTable } from '../schema/table-registry.ts';
import {
  GtfsValidationNoticeCode,
  type GtfsValidationNotice,
} from '../diagnostics/errors.ts';
import { encodeGtfsCanonicalKey } from '../database/storage/key.ts';
import { createValidationNotice } from './notice.ts';
import { formatGtfsSourcePosition } from '../diagnostics/position.ts';
import type {
  ParsedGtfsSourceFile,
  ValidateGtfsSourceOptions,
} from './types.ts';
import { isEmptyGtfsValue } from './values.ts';
import type { GtfsValidationKeyTracker } from '../schedule/import/staging/key-store.ts';

function encodeRowPrimaryKey(
  row: Readonly<Record<string, string>>,
  table: CompiledGtfsTable,
): string {
  return encodeGtfsCanonicalKey(
    table.primaryKey.map((field) =>
      isEmptyGtfsValue(row[field]) ? null : row[field],
    ),
  );
}

export function validateGtfsDuplicateKeys({
  options,
  table,
  source,
  primaryKeys,
}: {
  options: ValidateGtfsSourceOptions;
  table: FileBackedCompiledGtfsTable;
  source: ParsedGtfsSourceFile;
  primaryKeys: GtfsValidationKeyTracker;
}): readonly GtfsValidationNotice[] {
  if (options.mode === 'off' || table.primaryKey.length === 0) {
    return [];
  }

  const notices: GtfsValidationNotice[] = [];
  for (const { row, position } of source.records) {
    const key = encodeRowPrimaryKey(row, table);
    const firstPosition = primaryKeys.register(key, position);
    if (firstPosition === undefined) {
      continue;
    }
    notices.push(
      createValidationNotice(options, {
        code: GtfsValidationNoticeCode.DUPLICATE_PRIMARY_KEY,
        severity: options.onDuplicateKey === 'keep-first' ? 'warn' : 'error',
        message: `${table.filename} ${formatGtfsSourcePosition(position)} duplicates a primary key from ${formatGtfsSourcePosition(firstPosition)}`,
        filename: table.filename,
        position,
        firstPosition,
        details: {
          fields: table.primaryKey,
        },
      }),
    );
  }

  return notices;
}
