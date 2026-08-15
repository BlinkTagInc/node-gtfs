import Database from 'better-sqlite3';

import type { Config, Model, SqlValue } from '../types/global_interfaces.ts';
import type { ImportReport } from './errors.ts';
import type { NormalizedGtfsRow } from './gtfs-record-parser.ts';
import { log } from '../reporting/report.ts';
import {
  addImportWarning,
  GtfsErrorCategory,
  GtfsErrorCode,
  GtfsWarningCode,
  toGtfsError,
} from './errors.ts';
import { applyPrefixToValue, escapeIdentifier } from './utils.ts';

interface SqliteGtfsWriterOptions {
  db: Database.Database;
  model: Model;
  filename: string;
  ignoreDuplicates: boolean;
  sqlitePath: string;
  prefix?: string;
  config: Config;
  report?: ImportReport;
}

export interface SqliteGtfsWriter {
  writeBatch(rows: NormalizedGtfsRow[]): void;
}

export function createSqliteGtfsWriter(
  options: SqliteGtfsWriterOptions,
): SqliteGtfsWriter {
  const columns = options.model.schema;
  const prefixedColumns = columns.map((column) => Boolean(column.prefix));
  const statement = `INSERT ${options.ignoreDuplicates ? 'OR IGNORE' : ''} INTO ${escapeIdentifier(
    options.model.filenameBase,
  )} (${columns
    .map(({ name }) => escapeIdentifier(name))
    .join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  const insert = options.db.prepare(statement);

  const writeTransaction = options.db.transaction(
    (rows: NormalizedGtfsRow[]) => {
      for (let rowNumber = 0; rowNumber < rows.length; rowNumber++) {
        const row = rows[rowNumber];
        try {
          if (options.prefix === undefined) {
            insert.run(row as SqlValue[]);
          } else {
            const prefixedRow = new Array(row.length);
            for (let index = 0; index < row.length; index++) {
              prefixedRow[index] = applyPrefixToValue(
                row[index] as string,
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
            const primaryColumns = columns.filter((column) => column.primary);
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
    writeBatch(rows) {
      writeTransaction(rows);
    },
  };
}
