import Database from 'better-sqlite3';

import type {
  NormalizedGtfsRow,
  NormalizedGtfsRowBatch,
} from './gtfs-record-parser.ts';
import type { GtfsFileWriter, GtfsFileWriterOptions } from './gtfs-writer.ts';
import { log } from '../reporting/report.ts';
import {
  addImportWarning,
  GtfsErrorCategory,
  GtfsErrorCode,
  GtfsWarningCode,
  toGtfsError,
} from './errors.ts';
import { applyPrefixToValue, escapeIdentifier } from './utils.ts';

interface SqliteGtfsWriterOptions extends GtfsFileWriterOptions {
  db: Database.Database;
  sqlitePath: string;
}

export function createSqliteGtfsWriter(
  options: SqliteGtfsWriterOptions,
): GtfsFileWriter {
  const columns = options.table.columns;
  const prefixedColumns = columns.map((column) =>
    Boolean(column.applyFeedPrefix),
  );
  const statement = `INSERT ${options.ignoreDuplicates ? 'OR IGNORE' : ''} INTO ${escapeIdentifier(
    options.table.name,
  )} (${columns
    .map(({ name }) => escapeIdentifier(name))
    .join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  const insert = options.db.prepare(statement);

  const writeTransaction = options.db.transaction(
    (rows: readonly NormalizedGtfsRow[]) => {
      for (let rowNumber = 0; rowNumber < rows.length; rowNumber++) {
        const row = rows[rowNumber];
        try {
          if (options.prefix === undefined) {
            insert.run(row);
          } else {
            const prefixedRow = new Array(row.length);
            for (let index = 0; index < row.length; index++) {
              prefixedRow[index] = applyPrefixToValue(
                row[index],
                prefixedColumns[index],
                options.prefix,
              );
            }
            insert.run(prefixedRow);
          }
        } catch (error: unknown) {
          if (
            (error as Error & { code?: string }).code ===
            'SQLITE_CONSTRAINT_PRIMARYKEY'
          ) {
            const primaryColumns = columns.filter(
              (column) => column.primaryKey,
            );
            log(
              options.config,
              'warning',
              `Duplicate values for primary key (${primaryColumns.map((column) => column.name).join(', ')}) found in ${options.filename}. Set the \`ignoreDuplicates\` option to true in config.json to ignore this error`,
            );
            if (options.report) {
              addImportWarning(options.report, {
                code: GtfsWarningCode.GTFS_DUPLICATE_PRIMARY_KEY,
                message: `Duplicate values for primary key found in ${options.filename}.`,
                details: {
                  file: options.filename,
                  line: rowNumber + 1,
                  columns: primaryColumns.map((column) => column.name),
                },
              });
            }
          }

          log(
            options.config,
            'warning',
            `Skipping invalid data in ${options.filename} on line ${rowNumber + 1}`,
          );
          throw toGtfsError(error, {
            message: error instanceof Error ? error.message : String(error),
            code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
            category: GtfsErrorCategory.DATABASE,
            details: {
              file: options.filename,
              line: rowNumber + 1,
              sqlitePath: options.sqlitePath,
              dbCode: (error as { code?: unknown }).code,
            },
          });
        }
      }
    },
  );

  return {
    writeBatch(batch: NormalizedGtfsRowBatch) {
      if (batch.table.name !== options.table.name) {
        throw new Error(
          `Writer for ${options.table.name} received a batch for ${batch.table.name}`,
        );
      }
      writeTransaction(batch.rows);
    },
  };
}
