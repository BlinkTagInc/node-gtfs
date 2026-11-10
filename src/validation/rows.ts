import type { FileBackedCompiledGtfsTable } from '../schema/table-registry.ts';
import {
  GtfsValidationNoticeCode,
  type GtfsValidationNotice,
} from '../diagnostics/errors.ts';
import { createValidationNotice } from './notice.ts';
import type {
  ParsedGtfsSourceFile,
  ValidateGtfsSourceOptions,
} from './types.ts';
import { getComparableGtfsValue, isEmptyGtfsValue } from './values.ts';
import {
  parseGtfsPrimitiveValue,
  type GtfsPrimitiveParseResult,
} from '../values/parse.ts';
import { formatGtfsSourcePosition } from '../diagnostics/position.ts';

export function validateGtfsPrimitiveRows({
  options,
  table,
  source,
  parsedValues,
  columns = table.columns,
}: {
  options: ValidateGtfsSourceOptions;
  table: FileBackedCompiledGtfsTable;
  source: ParsedGtfsSourceFile;
  parsedValues?: Map<string, GtfsPrimitiveParseResult>;
  columns?: FileBackedCompiledGtfsTable['columns'];
}): readonly GtfsValidationNotice[] {
  if (options.mode === 'off') {
    return [];
  }
  const notices: GtfsValidationNotice[] = [];

  for (const { row, position } of source.records) {
    for (const column of columns) {
      const value = row[column.name];
      if (column.presence === 'required' && isEmptyGtfsValue(value)) {
        notices.push(
          createValidationNotice(options, {
            code: GtfsValidationNoticeCode.REQUIRED_VALUE_MISSING,
            severity: 'error',
            message: `${table.filename} ${formatGtfsSourcePosition(position)} is missing required value ${JSON.stringify(column.name)}`,
            filename: table.filename,
            position,
            field: column.name,
          }),
        );
        continue;
      }
      if (isEmptyGtfsValue(value)) {
        continue;
      }

      const parsed = parseGtfsPrimitiveValue(value, column, row);
      parsedValues?.set(column.name, parsed);
      if (!parsed.valid) {
        notices.push(
          createValidationNotice(options, {
            code: GtfsValidationNoticeCode.INVALID_VALUE,
            severity: 'error',
            message: `${table.filename} ${formatGtfsSourcePosition(position)} has invalid ${column.kind} value for ${JSON.stringify(column.name)}`,
            filename: table.filename,
            position,
            field: column.name,
            details: { value, expectedKind: column.kind },
          }),
        );
        continue;
      }

      if (column.kind === 'enumeration' && column.closed) {
        const candidate =
          column.valueKind === 'integer' ? Number(parsed.value) : value;
        if (!column.values.includes(candidate)) {
          notices.push(
            createValidationNotice(options, {
              code: GtfsValidationNoticeCode.INVALID_VALUE,
              severity: 'error',
              message: `${table.filename} ${formatGtfsSourcePosition(position)} has an unsupported value for ${JSON.stringify(column.name)}`,
              filename: table.filename,
              position,
              field: column.name,
              details: { value, allowed: column.values },
            }),
          );
        }
      }

      if (column.minimum === undefined && column.maximum === undefined) {
        continue;
      }
      const comparable =
        parsed.serviceDaySeconds ?? getComparableGtfsValue(value, column);
      if (
        (column.minimum !== undefined && comparable < column.minimum) ||
        (column.maximum !== undefined && comparable > column.maximum)
      ) {
        notices.push(
          createValidationNotice(options, {
            code: GtfsValidationNoticeCode.RANGE,
            severity: 'error',
            message: `${table.filename} ${formatGtfsSourcePosition(position)} has an out-of-range value for ${JSON.stringify(column.name)}`,
            filename: table.filename,
            position,
            field: column.name,
            details: {
              value,
              minimum: column.minimum,
              maximum: column.maximum,
            },
          }),
        );
      }
    }
  }

  return notices;
}
