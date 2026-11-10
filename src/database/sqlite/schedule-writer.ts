import Database from 'better-sqlite3';

import type {
  NormalizedImportRecord,
  NormalizedImportRowBatch,
} from '../../schedule/import/records.ts';
import {
  reportStoredDuplicateKeys,
  toGtfsWriteError,
  type GtfsFileWriter,
  type GtfsScheduleWriterOptions,
} from '../../schedule/import/writer.ts';
import { quoteSqliteIdentifier } from './identifier.ts';
import { getGtfsTableStoragePlan } from '../storage/plan.ts';
import { createGtfsStorageValuesProjector } from '../storage/row-projection.ts';

interface SqliteGtfsWriterOptions extends GtfsScheduleWriterOptions<Database.Database> {
  readonly databasePath: string;
}

export function createSqliteGtfsWriter(
  options: SqliteGtfsWriterOptions,
): GtfsFileWriter {
  const tablePlan = getGtfsTableStoragePlan(
    options.storagePlan,
    options.table.tableName,
  );
  const insertColumns = tablePlan.columns.filter(
    ({ role }) => role !== 'service-time',
  );
  const insertColumnNames = insertColumns.map(({ name }) => name);
  const insertPrefix = `INSERT INTO ${quoteSqliteIdentifier(options.table.tableName)} (${insertColumnNames
    .map((name) => quoteSqliteIdentifier(name))
    .join(', ')}) VALUES `;
  const conflictClause =
    options.onDuplicateKey === 'keep-first' ? ' ON CONFLICT DO NOTHING' : '';
  const prepareInsert = (boundColumns: typeof insertColumns) => {
    const bound = new Set(boundColumns);
    // Explicit NULL preserves stored nulls rather than activating SQL defaults.
    const values = insertColumns.map((column) =>
      bound.has(column) ? '?' : 'NULL',
    );
    return {
      insert: options.database.prepare(
        `${insertPrefix}(${values.join(', ')})${conflictClause}`,
      ),
      projectValues: createGtfsStorageValuesProjector(tablePlan, boundColumns),
    };
  };
  const allColumnsInsert = prepareInsert(insertColumns);

  const writeTransaction = options.database.transaction(
    (records: readonly NormalizedImportRecord[]) => {
      if (records.length === 0) {
        return 0;
      }
      const boundColumns = insertColumns.filter((column) => {
        if (
          column.role === 'canonical-key' ||
          column.role === 'storage-key-hash'
        ) {
          return true;
        }
        const name =
          column.role === 'case-fold' ? column.sourceColumn?.name : column.name;
        return (
          name === undefined ||
          records.some(
            ({ row }) => row[name] !== null && row[name] !== undefined,
          )
        );
      });
      const { insert, projectValues } =
        boundColumns.length === insertColumns.length
          ? allColumnsInsert
          : prepareInsert(boundColumns);
      let rowsInserted = 0;
      for (const { row, position } of records) {
        try {
          const result = insert.run(projectValues(row));
          rowsInserted += result.changes;
        } catch (error: unknown) {
          throw toGtfsWriteError(error, options, {
            position,
            databaseDialect: 'sqlite',
            databasePath: options.databasePath,
          });
        }
      }
      return rowsInserted;
    },
  );

  return {
    writeBatch(batch: NormalizedImportRowBatch) {
      if (batch.table.tableName !== options.table.tableName) {
        throw new Error(
          `Writer for ${options.table.tableName} received a batch for ${batch.table.tableName}`,
        );
      }
      const rowsInserted = writeTransaction(batch.records);
      const skippedStoredRows = batch.records.length - rowsInserted;
      reportStoredDuplicateKeys(options, skippedStoredRows);
      return { rowsInserted, rowsSkipped: skippedStoredRows };
    },
  };
}
