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
import { isEmptyGtfsValue, matchesGtfsRowCondition } from './values.ts';

function getValidationTable(
  tablesByFilename: ReadonlyMap<string, FileBackedCompiledGtfsTable>,
  filename: string,
): FileBackedCompiledGtfsTable {
  const table = tablesByFilename.get(filename);
  if (table === undefined) {
    throw new Error(`No GTFS table metadata found for parsed file ${filename}`);
  }
  return table;
}

export function* iterateGtfsReferenceNotices({
  options,
  parsedFiles,
  tablesByFilename,
  targetIndex,
  referenceSeverity,
}: {
  options: ValidateGtfsSourceOptions;
  parsedFiles: ReadonlyMap<string, ParsedGtfsSourceFile>;
  tablesByFilename: ReadonlyMap<string, FileBackedCompiledGtfsTable>;
  targetIndex?: (
    filename: string,
    field: string,
  ) => { has(value: string): boolean } | undefined;
  referenceSeverity?: (reference: {
    readonly filename: string;
    readonly field: string;
    readonly row: Readonly<Record<string, string>>;
  }) => GtfsValidationNotice['severity'] | undefined;
}): Generator<GtfsValidationNotice> {
  if (options.mode === 'off') {
    return;
  }

  const targetValues = new Map<string, ReadonlySet<string> | undefined>();
  const getTargetValues = (targetFilename: string, targetField: string) => {
    if (targetIndex !== undefined) {
      return targetIndex(targetFilename, targetField);
    }
    const key = `${targetFilename}\0${targetField}`;
    if (targetValues.has(key)) {
      return targetValues.get(key);
    }
    const source = parsedFiles.get(targetFilename);
    let values: Set<string> | undefined;
    if (
      source !== undefined &&
      getValidationTable(tablesByFilename, targetFilename).columns.some(
        (column) => column.name === targetField,
      )
    ) {
      values = new Set<string>();
      for (const { row } of source.records) {
        const value = row[targetField];
        if (!isEmptyGtfsValue(value)) {
          values.add(value);
        }
      }
    }
    targetValues.set(key, values);
    return values;
  };

  for (const [filename, source] of parsedFiles) {
    const table = getValidationTable(tablesByFilename, filename);
    const referenceColumns = table.columns.flatMap((column) => {
      const references = (column.references ?? []).filter(
        (reference) =>
          reference.when !== undefined || reference.relationship !== 'advisory',
      );
      return references.length === 0
        ? []
        : [{ field: column.name, references }];
    });
    if (referenceColumns.length === 0) {
      continue;
    }
    for (const { row, position } of source.records) {
      for (const { field, references } of referenceColumns) {
        const value = row[field];
        if (isEmptyGtfsValue(value)) {
          continue;
        }
        const applicable = references.filter(
          (reference) =>
            reference.when === undefined ||
            matchesGtfsRowCondition(row, reference.when),
        );
        // Alternative references form a union, limited to this row's conditions.
        // Leave unavailable/excluded target files to file-level validation.
        let hasAvailableTarget = false;
        const matchesTarget = applicable.some((reference) => {
          const values = getTargetValues(
            reference.targetFilename,
            reference.targetField,
          );
          if (values === undefined) {
            return false;
          }
          hasAvailableTarget = true;
          return values.has(value);
        });
        if (!hasAvailableTarget || matchesTarget) {
          continue;
        }
        const targets = applicable.map((reference) => ({
          targetFilename: reference.targetFilename,
          targetField: reference.targetField,
          relationship: reference.relationship ?? 'advisory',
        }));
        yield createValidationNotice(options, {
          code: GtfsValidationNoticeCode.REFERENCE_NOT_FOUND,
          severity:
            referenceSeverity?.({ filename, field, row }) ??
            (targets.every(({ relationship }) => relationship === 'unambiguous')
              ? 'error'
              : 'warn'),
          message: `${filename} ${formatGtfsSourcePosition(position)} references missing ${targets.map(({ targetFilename, targetField }) => `${targetFilename}.${targetField}`).join(' or ')}`,
          filename,
          position,
          field,
          details: {
            value,
            ...(targets.length === 1 ? targets[0] : { targets }),
          },
        });
      }
    }
  }
}
