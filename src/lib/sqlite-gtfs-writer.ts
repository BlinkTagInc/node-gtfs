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
import {
  getGtfsIndexName,
  getGtfsIndexPlan,
  getPrimaryKeyColumns,
  getTimestampColumnName,
  type CompiledGtfsTable,
} from '../schema/compile-table.ts';
import { compiledTables } from '../schema/table-registry.ts';
import { applyPrefixToValue } from './feed-prefix.ts';
import { escapeIdentifier } from './sql-clauses.ts';

function createTable(
  db: Database.Database,
  tableDefinition: CompiledGtfsTable,
  dropExisting = true,
): void {
  const sqlColumnCreateStatements = [];

  for (const column of tableDefinition.columns) {
    const columnName = escapeIdentifier(column.name);
    const checks = [];
    if (column.sqlMinimum !== undefined && column.sqlMaximum !== undefined) {
      checks.push(
        `${columnName} >= ${column.sqlMinimum} AND ${columnName} <= ${column.sqlMaximum}`,
      );
    } else if (column.sqlMinimum !== undefined) {
      checks.push(`${columnName} >= ${column.sqlMinimum}`);
    } else if (column.sqlMaximum !== undefined) {
      checks.push(`${columnName} <= ${column.sqlMaximum}`);
    }

    if (column.storageKind === 'integer') {
      checks.push(
        `(TYPEOF(${columnName}) = 'integer' OR ${columnName} IS NULL)`,
      );
    } else if (column.storageKind === 'real') {
      checks.push(`(TYPEOF(${columnName}) = 'real' OR ${columnName} IS NULL)`);
    }

    const required = column.presence === 'required' ? 'NOT NULL' : '';
    const defaultValue =
      column.defaultValue === null
        ? 'NULL'
        : typeof column.defaultValue === 'string'
          ? `'${column.defaultValue.replaceAll("'", "''")}'`
          : String(column.defaultValue);
    const columnDefault =
      column.defaultValue === undefined ? '' : `DEFAULT ${defaultValue}`;
    const columnCollation = column.caseInsensitiveComparison
      ? 'COLLATE NOCASE'
      : '';
    const checkClause =
      checks.length > 0 ? `CHECK(${checks.join(' AND ')})` : '';

    sqlColumnCreateStatements.push(
      `${columnName} ${column.storageKind} ${checkClause} ${required} ${columnDefault} ${columnCollation}`,
    );

    // Add an additional timestamp column for time columns
    if (column.storageKind === 'time') {
      sqlColumnCreateStatements.push(
        `${escapeIdentifier(getTimestampColumnName(column.name))} INTEGER GENERATED ALWAYS AS (
            CASE
              WHEN ${columnName} IS NULL OR ${columnName} = '' THEN NULL
              ELSE CAST(
                substr(${columnName}, 1, instr(${columnName}, ':') - 1) * 3600 +
                substr(${columnName}, instr(${columnName}, ':') + 1, 2) * 60 +
                substr(${columnName}, -2) AS INTEGER
              )
            END
          ) STORED`,
      );
    }
  }

  const keyColumns = getPrimaryKeyColumns(tableDefinition);
  if (keyColumns.length > 0) {
    sqlColumnCreateStatements.push(
      `PRIMARY KEY (${keyColumns
        .map(({ name }) => escapeIdentifier(name))
        .join(', ')})`,
    );
  }

  const tableName = escapeIdentifier(tableDefinition.name);
  if (dropExisting) {
    db.prepare(`DROP TABLE IF EXISTS ${tableName};`).run();
  }

  db.prepare(
    `CREATE TABLE ${tableName} (${sqlColumnCreateStatements.join(', ')});`,
  ).run();
}

// For columns that are mostly empty, use a partial index (`WHERE column IS NOT NULL`) instead of a full index.
const SPARSE_COLUMN_MAX_DENSITY = 0.1;

function createIndex(
  db: Database.Database,
  tableName: string,
  columnName: string,
  partial: boolean,
): void {
  const escapedTableName = escapeIdentifier(tableName);
  const escapedColumnName = escapeIdentifier(columnName);
  const indexName = escapeIdentifier(getGtfsIndexName(tableName, [columnName]));
  const predicate = partial ? ` WHERE ${escapedColumnName} IS NOT NULL` : '';
  db.prepare(
    `CREATE INDEX ${indexName} ON ${escapedTableName} (${escapedColumnName})${predicate};`,
  ).run();
}

function createCompositeIndex(
  db: Database.Database,
  tableName: string,
  columns: string[],
): void {
  const indexName = escapeIdentifier(getGtfsIndexName(tableName, columns));
  db.prepare(
    `CREATE INDEX ${indexName} ON ${escapeIdentifier(tableName)} (${columns
      .map((columnName) => escapeIdentifier(columnName))
      .join(', ')});`,
  ).run();
}

function createIndexesForTable(
  db: Database.Database,
  table: CompiledGtfsTable,
): void {
  const { singleColumnIndexes, compositeIndexes } = getGtfsIndexPlan(table, {
    includeGeneratedTimeIndexes: true,
  });

  if (singleColumnIndexes.length > 0) {
    const { rowCount } = db
      .prepare(
        `SELECT COUNT(*) AS rowCount FROM ${escapeIdentifier(table.name)}`,
      )
      .get() as { rowCount: number };

    if (rowCount === 0) {
      for (const columnName of singleColumnIndexes) {
        createIndex(db, table.name, columnName, false);
      }
    } else {
      const counts = db
        .prepare(
          `SELECT ${singleColumnIndexes
            .map(
              (columnName, index) =>
                `COUNT(${escapeIdentifier(columnName)}) AS ${escapeIdentifier(`c${index}`)}`,
            )
            .join(', ')} FROM ${escapeIdentifier(table.name)}`,
        )
        .get() as Record<string, number>;

      for (const [index, columnName] of singleColumnIndexes.entries()) {
        const density = counts[`c${index}`] / rowCount;
        createIndex(
          db,
          table.name,
          columnName,
          density <= SPARSE_COLUMN_MAX_DENSITY,
        );
      }
    }
  }

  for (const columns of compositeIndexes) {
    createCompositeIndex(db, table.name, columns);
  }
}

interface SqliteTableColumn {
  name: string;
  type: string;
  pk: number;
}

function getSqliteTableColumns(
  db: Database.Database,
  tableName: string,
): SqliteTableColumn[] | undefined {
  const table = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  if (table === undefined) return undefined;

  return db
    .prepare(`PRAGMA table_info(${escapeIdentifier(tableName)})`)
    .all() as SqliteTableColumn[];
}

function tableNeedsMigration(
  table: CompiledGtfsTable,
  columns: SqliteTableColumn[],
): boolean {
  const columnsByName = new Map(columns.map((column) => [column.name, column]));

  for (const column of table.columns) {
    const existingColumn = columnsByName.get(column.name);
    if (
      existingColumn === undefined ||
      existingColumn.type.toLowerCase() !== column.storageKind
    ) {
      return true;
    }
  }

  const existingPrimaryKey = columns
    .filter((column) => column.pk > 0)
    .sort((left, right) => left.pk - right.pk)
    .map((column) => column.name);
  const expectedPrimaryKey = getPrimaryKeyColumns(table).map(
    (column) => column.name,
  );

  return existingPrimaryKey.join('\0') !== expectedPrimaryKey.join('\0');
}

function migrateTable(
  db: Database.Database,
  table: CompiledGtfsTable,
  existingColumns: SqliteTableColumn[],
): void {
  const previousTableName = `${table.name}__node_gtfs_previous`;
  const escapedTableName = escapeIdentifier(table.name);
  const escapedPreviousTableName = escapeIdentifier(previousTableName);

  db.prepare(
    `ALTER TABLE ${escapedTableName} RENAME TO ${escapedPreviousTableName}`,
  ).run();
  createTable(db, table, false);

  const existingColumnNames = new Set(
    existingColumns.map((column) => column.name),
  );
  const sharedColumns = table.columns
    .map((column) => column.name)
    .filter((columnName) => existingColumnNames.has(columnName));
  const missingRequiredColumn = table.columns.some(
    (column) =>
      !existingColumnNames.has(column.name) &&
      column.presence === 'required' &&
      column.defaultValue === undefined,
  );

  if (sharedColumns.length > 0 && !missingRequiredColumn) {
    const columns = sharedColumns.map(escapeIdentifier).join(', ');
    db.prepare(
      `INSERT OR IGNORE INTO ${escapedTableName} (${columns}) SELECT ${columns} FROM ${escapedPreviousTableName}`,
    ).run();
  }

  db.prepare(`DROP TABLE ${escapedPreviousTableName}`).run();
  createIndexesForTable(db, table);
}

export function migrateSqliteGtfsRealtimeTables(db: Database.Database): void {
  const migrations = compiledTables
    .filter((table) => table.namespace === 'gtfs-realtime')
    .map((table) => ({
      table,
      existingColumns: getSqliteTableColumns(db, table.name),
    }))
    .filter(
      ({ table, existingColumns }) =>
        existingColumns === undefined ||
        tableNeedsMigration(table, existingColumns),
    );

  if (migrations.length === 0) return;

  db.transaction(() => {
    for (const { table, existingColumns } of migrations) {
      if (existingColumns === undefined) {
        createTable(db, table, false);
        createIndexesForTable(db, table);
      } else {
        migrateTable(db, table, existingColumns);
      }
    }
  })();
}

/** Recreates managed GTFS tables. */
export function createSqliteGtfsTables(db: Database.Database): void {
  for (const table of compiledTables) {
    createTable(db, table);
  }
}

/** Creates indexes for managed GTFS tables. */
export function createSqliteGtfsIndexes(db: Database.Database): void {
  for (const table of compiledTables) {
    createIndexesForTable(db, table);
  }
}

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
            const primaryColumns = getPrimaryKeyColumns(options.table);
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
