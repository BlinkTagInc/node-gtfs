import type { FileBackedCompiledGtfsTable } from '../schema/table-registry.ts';
import {
  GtfsValidationNoticeCode,
  type GtfsValidationNotice,
} from '../diagnostics/errors.ts';
import { createValidationNotice } from './notice.ts';
import { formatGtfsSourcePosition } from '../diagnostics/position.ts';
import type {
  ParsedGtfsSourceFile,
  ValidateGtfsSourceOptions,
} from './types.ts';
import {
  getComparableGtfsValue,
  isEmptyGtfsValue,
  matchesGtfsRowCondition,
} from './values.ts';

export function validateGtfsSemanticConstraints({
  options,
  table,
  source,
}: {
  options: ValidateGtfsSourceOptions;
  table: FileBackedCompiledGtfsTable;
  source: ParsedGtfsSourceFile;
}): readonly GtfsValidationNotice[] {
  if (options.mode === 'off') {
    return [];
  }

  const notices: GtfsValidationNotice[] = [];
  for (const { row, position } of source.records) {
    for (const constraint of table.constraints ?? []) {
      if (constraint.kind === 'conditional-presence') {
        if (!matchesGtfsRowCondition(row, constraint.when)) {
          continue;
        }
        const empty = isEmptyGtfsValue(row[constraint.field]);
        const invalid = constraint.presence === 'required' ? empty : !empty;
        if (invalid) {
          notices.push(
            createValidationNotice(options, {
              code: GtfsValidationNoticeCode.CONDITIONAL_PRESENCE,
              severity: 'error',
              message: `${table.filename} ${formatGtfsSourcePosition(position)} violates conditional presence for ${JSON.stringify(constraint.field)}`,
              filename: table.filename,
              position,
              field: constraint.field,
              details: { condition: constraint.when },
            }),
          );
        }
        continue;
      }

      const start = row[constraint.startField];
      const end = row[constraint.endField];
      if (isEmptyGtfsValue(start) || isEmptyGtfsValue(end)) {
        continue;
      }
      const startColumn = table.columns.find(
        (column) => column.name === constraint.startField,
      );
      if (startColumn === undefined) {
        throw new Error(
          `GTFS table ${table.tableName} range constraint references missing column ${constraint.startField}`,
        );
      }
      const startValue = getComparableGtfsValue(start, startColumn);
      const endValue = getComparableGtfsValue(end, startColumn);
      if (
        startValue > endValue ||
        (!constraint.allowEqual && startValue === endValue)
      ) {
        notices.push(
          createValidationNotice(options, {
            code: GtfsValidationNoticeCode.RANGE,
            severity: 'error',
            message: `${table.filename} ${formatGtfsSourcePosition(position)} has ${JSON.stringify(constraint.startField)} after ${JSON.stringify(constraint.endField)}`,
            filename: table.filename,
            position,
            field: constraint.endField,
            details: {
              startField: constraint.startField,
              start,
              endField: constraint.endField,
              end,
            },
          }),
        );
      }
    }
  }

  return notices;
}
