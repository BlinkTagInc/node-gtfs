import { cancellationCheckpoint } from '../../cancellation.ts';
import path from 'node:path';
import type { FileBackedCompiledGtfsTable } from '../../schema/table-registry.ts';
import { readGtfsSourceRecordBatches } from './read-source.ts';
import { validateGtfsHeaders } from '../../validation/headers.ts';
import { validateGtfsPrimitiveRows } from '../../validation/rows.ts';
import { validateGtfsSemanticConstraints } from '../../validation/semantics.ts';
import { validateGtfsDuplicateKeys } from '../../validation/duplicates.ts';
import { normalizeGtfsRecord } from '../../values/normalize-row.ts';
import type { GtfsPrimitiveParseResult } from '../../values/parse.ts';
import type { ValidateGtfsSourceOptions } from '../../validation/types.ts';
import type { GtfsWorkingStore } from './staging/store.ts';
import type { GtfsShapeRequirements } from '../../validation/shapes.ts';
import { isEmptyGtfsValue } from '../../validation/values.ts';
import { getStorageKeyColumnNames } from '../../schema/compile-table.ts';
import { createValidationNotice } from '../../validation/notice.ts';
import {
  GtfsValidationNoticeCode,
  type GtfsValidationNotice,
} from '../../diagnostics/errors.ts';
import { formatGtfsSourcePosition } from '../../diagnostics/position.ts';
import type {
  NormalizedImportRecord,
  NormalizedImportRowBatch,
} from './records.ts';

export interface GtfsNormalizedBatchSink {
  readonly batchSize: number;
  writeBatch(batch: NormalizedImportRowBatch): void | Promise<void>;
}

export interface GtfsImportSourceOptions extends ValidateGtfsSourceOptions {
  readonly sourceId: string;
  readonly defaultAgencyId?: string;
  readonly onFileRead?: (file: {
    readonly filename: string;
    readonly recordsRead: number;
    readonly rowsSkipped: number;
  }) => void;
}

export interface GtfsDirectImportSourceOptions extends GtfsImportSourceOptions {
  readonly mode: 'off';
  readonly onUnknownField: 'preserve';
  readonly onDuplicateKey: 'reject';
}

export type GtfsSourceProcessing =
  | {
      readonly mode: 'stage';
      readonly options: GtfsImportSourceOptions;
      readonly sink?: never;
    }
  | {
      readonly mode: 'direct';
      readonly options: GtfsDirectImportSourceOptions;
      readonly sink: GtfsNormalizedBatchSink;
    };

export async function scanGtfsSourceFile({
  processing,
  table,
  store,
  phase,
  sourceFields,
  targetFields,
  shapeRequirements,
  defaultAgencyId = processing.options.defaultAgencyId,
}: {
  readonly processing: GtfsSourceProcessing;
  readonly table: FileBackedCompiledGtfsTable;
  readonly store: GtfsWorkingStore;
  readonly phase: number;
  readonly sourceFields: readonly string[];
  readonly targetFields: readonly string[];
  readonly shapeRequirements?: GtfsShapeRequirements;
  readonly defaultAgencyId?: string;
}) {
  const { options } = processing;
  const normalization = {
    sourceId: options.sourceId,
    ...(defaultAgencyId === undefined ? {} : { defaultAgencyId }),
  };
  const sink = processing.mode === 'direct' ? processing.sink : undefined;
  let headers: readonly string[] = [];
  let primitiveColumns = table.columns;
  let rowCount = 0;
  let rowsSkipped = 0;
  let totalRecordCount = 0;
  let agencyId: string | undefined;
  let normalizationError: unknown;
  let lastProgressTime = 0;
  options.onProgress?.({
    stage: 'file',
    phase: 'start',
    filename: table.filename,
    rows: 0,
  });
  const primaryKeys = store.primaryKeys(table.filename);
  const writeRecord =
    processing.mode === 'stage'
      ? store.recordWriter({
          table,
          keepFirst: options.onDuplicateKey === 'keep-first',
        })
      : undefined;
  const parsedValues = new Map<string, GtfsPrimitiveParseResult>();
  let pendingRecords: NormalizedImportRecord[] = [];
  try {
    await cancellationCheckpoint();
    for await (const batch of readGtfsSourceRecordBatches({
      filePath: path.join(options.directory, table.filename),
      table,
      csv: options.csv ?? {},
      onHeaders(value) {
        headers = value;
        if (options.mode !== 'off') {
          const present = new Set(headers);
          // Required values must still be checked even when their header is absent.
          primitiveColumns = table.columns.filter(
            (column) =>
              column.presence === 'required' || present.has(column.name),
          );
        }
        store.addNotices(
          phase,
          validateGtfsHeaders({
            options,
            table,
            source: { headers, records: [] },
          }),
        );
      },
    })) {
      await cancellationCheckpoint();
      for (const { record, validationRecord, position } of batch) {
        rowCount += 1;
        totalRecordCount =
          position.kind === 'csv'
            ? position.recordNumber
            : position.featureNumber;
        if (table.filename === 'agency.txt' && rowCount === 1) {
          agencyId = validationRecord.agency_id?.trim() || undefined;
        }
        let duplicateNotices: readonly GtfsValidationNotice[] = [];
        if (options.mode !== 'off') {
          const source = {
            headers,
            records: [{ row: validationRecord, position }],
          };
          parsedValues.clear();
          store.addNotices(
            phase + 1,
            validateGtfsPrimitiveRows({
              options,
              table,
              source,
              parsedValues,
              columns: primitiveColumns,
            }),
          );
          store.addNotices(
            phase + 2,
            validateGtfsSemanticConstraints({ options, table, source }),
          );
          duplicateNotices = validateGtfsDuplicateKeys({
            options,
            table,
            source,
            primaryKeys,
          });
          store.addNotices(phase + 3, duplicateNotices);
          shapeRequirements?.observe({
            filename: table.filename,
            row: validationRecord,
            parsedValues,
          });
        }
        if (sourceFields.length > 0) {
          store.addReferenceRow(table.filename, rowCount, {
            row: Object.fromEntries(
              sourceFields.map((field) => [
                field,
                validationRecord[field] ?? '',
              ]),
            ),
            position,
          });
        }
        for (const field of targetFields) {
          const value = validationRecord[field];
          if (!isEmptyGtfsValue(value)) {
            store.addReferenceValue(table.filename, field, value);
          }
        }
        let row;
        try {
          row = normalizeGtfsRecord(record, table, {
            ...normalization,
            position,
            onUnknownField: options.onUnknownField,
            parsedValues,
          });
        } catch (error) {
          // Off must not silently discard records that cannot be represented.
          if (options.mode === 'off') {
            throw error;
          }
          rowsSkipped += 1;
          if (options.mode === 'strict') {
            normalizationError ??= error;
          }
          continue;
        }
        const duplicate = writeRecord?.(rowCount, { row, position });
        if (duplicate !== undefined) {
          rowsSkipped += 1;
        }
        if (duplicate !== undefined && duplicateNotices.length === 0) {
          store.addNotices(phase + 3, [
            createValidationNotice(options, {
              code: GtfsValidationNoticeCode.DUPLICATE_PRIMARY_KEY,
              severity: 'warn',
              message: `${table.filename} ${formatGtfsSourcePosition(position)} matches the normalized storage key from ${formatGtfsSourcePosition(duplicate.firstPosition)} and was skipped`,
              filename: table.filename,
              position,
              firstPosition: duplicate.firstPosition,
              details: {
                scope: 'normalized',
                fields: getStorageKeyColumnNames(table),
              },
            }),
          ]);
        }
        if (sink !== undefined) {
          pendingRecords.push(
            Object.freeze({ row, position: Object.freeze(position) }),
          );
          if (pendingRecords.length >= sink.batchSize) {
            await sink.writeBatch({
              table,
              records: pendingRecords,
              totalRecordCount,
            });
            pendingRecords = [];
          }
        }
      }
      if (options.onProgress !== undefined) {
        const now = Date.now();
        if (now - lastProgressTime >= 100) {
          options.onProgress({
            stage: 'file',
            phase: 'progress',
            filename: table.filename,
            rows: rowCount,
          });
          lastProgressTime = now;
        }
      }
    }
    if (sink !== undefined && pendingRecords.length > 0) {
      await sink.writeBatch({
        table,
        records: pendingRecords,
        totalRecordCount,
      });
    }
    options.onProgress?.({
      stage: 'file',
      phase: 'complete',
      filename: table.filename,
      rows: rowCount,
    });
    return {
      headers,
      rowCount,
      totalRecordCount,
      normalizationError,
      agencyId: rowCount === 1 ? agencyId : undefined,
    };
  } finally {
    options.onFileRead?.({
      filename: table.filename,
      recordsRead: rowCount,
      rowsSkipped,
    });
  }
}
