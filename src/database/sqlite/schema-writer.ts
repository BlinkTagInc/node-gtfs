import Database from 'better-sqlite3';
import { assertGtfsSchemaOptions } from '../schema-options.ts';
import { sqliteServiceTimeExpression } from './expressions.ts';

import { inspectSqliteGtfsStoragePlan } from './schema-inspector.ts';
import type {
  GtfsSchemaInspection,
  GtfsSchemaLifecycleOptions,
  GtfsSchemaMode,
} from '../schema-lifecycle.ts';
import { quoteSqliteIdentifier } from './identifier.ts';
import {
  createGtfsStoragePlan,
  type GtfsStorageColumnCheckPlan,
  type GtfsStorageColumnPlan,
  type GtfsStorageIndexPlan,
  type GtfsStoragePlan,
  type GtfsTableStoragePlan,
} from '../storage/plan.ts';

type SingleColumnStorageIndexPlan = GtfsStorageIndexPlan & {
  readonly columns: readonly [string];
};

function isSingleColumnStorageIndex(
  index: GtfsStorageIndexPlan,
): index is SingleColumnStorageIndexPlan {
  return index.columns.length === 1;
}

function sqliteColumnDataType(column: GtfsStorageColumnPlan): string {
  if (column.role === 'manifest') {
    return column.dataType === 'bigint' ? 'integer' : column.dataType;
  }
  if (column.dataType === 'integer' || column.dataType === 'bigint') {
    return 'INTEGER';
  }
  if (column.dataType === 'json') {
    return 'JSON';
  }
  return 'TEXT';
}

function sqliteLiteral(value: string | number | null): string {
  if (value === null) {
    return 'NULL';
  }
  return typeof value === 'string'
    ? `'${value.replaceAll("'", "''")}'`
    : String(value);
}

function sqliteCheckExpression(
  columnName: string,
  check: GtfsStorageColumnCheckPlan,
): string {
  if (check.kind === 'allowed-values') {
    return `${columnName} IN (${check.values.map(sqliteLiteral).join(', ')})`;
  }
  if (check.kind === 'range') {
    if (check.minimum !== undefined && check.maximum !== undefined) {
      return `${columnName} >= ${check.minimum} AND ${columnName} <= ${check.maximum}`;
    }
    if (check.minimum !== undefined) {
      return `${columnName} >= ${check.minimum}`;
    }
    return `${columnName} <= ${check.maximum}`;
  }
  if (check.kind === 'storage-class') {
    return `(TYPEOF(${columnName}) = '${check.storageClass}' OR ${columnName} IS NULL)`;
  }
  return `length(${columnName}) = ${check.length}`;
}

function sqliteColumnDefinition(column: GtfsStorageColumnPlan): string {
  const columnName = quoteSqliteIdentifier(column.name);
  if (column.generatedValue?.kind === 'service-time-seconds') {
    return `${columnName} INTEGER GENERATED ALWAYS AS (${sqliteServiceTimeExpression(column.generatedValue.sourceColumnName)}) STORED`;
  }

  const checks = column.checks.map((check) =>
    sqliteCheckExpression(columnName, check),
  );
  const checkClause =
    checks.length === 0 ? '' : `CHECK(${checks.join(' AND ')})`;
  const required = column.required ? 'NOT NULL' : '';
  const defaultClause =
    column.defaultValue === undefined
      ? ''
      : `DEFAULT ${sqliteLiteral(column.defaultValue)}`;
  const collation = column.binaryCollation ? 'COLLATE BINARY' : '';
  if (column.role === 'manifest') {
    return `${columnName} ${sqliteColumnDataType(column)} ${checkClause} ${required} ${defaultClause} ${collation}`;
  }
  const clauses =
    column.role === 'canonical-key'
      ? [columnName, sqliteColumnDataType(column), required, checkClause]
      : [
          columnName,
          sqliteColumnDataType(column),
          checkClause,
          required,
          defaultClause,
          collation,
        ];
  return clauses.filter(Boolean).join(' ');
}

function createTable(
  database: Database.Database,
  tablePlan: GtfsTableStoragePlan,
  mode: Exclude<GtfsSchemaMode, 'validate'>,
): void {
  const sqlColumnCreateStatements = tablePlan.columns.map(
    sqliteColumnDefinition,
  );
  if (tablePlan.key.kind === 'unique') {
    sqlColumnCreateStatements.push(
      `UNIQUE (${tablePlan.key.columns.map(quoteSqliteIdentifier).join(', ')})`,
    );
  } else if (tablePlan.key.kind === 'primary-key') {
    sqlColumnCreateStatements.push(
      `PRIMARY KEY (${tablePlan.key.columns.map(quoteSqliteIdentifier).join(', ')})`,
    );
  }

  const tableName = quoteSqliteIdentifier(tablePlan.table.tableName);
  if (mode === 'recreate') {
    database.prepare(`DROP TABLE IF EXISTS ${tableName};`).run();
  }

  database
    .prepare(
      `CREATE TABLE ${mode === 'ensure' ? 'IF NOT EXISTS ' : ''}${tableName} (${sqlColumnCreateStatements.join(', ')});`,
    )
    .run();
}

// For columns that are mostly empty, use a partial index (`WHERE column IS NOT NULL`) instead of a full index.
const SPARSE_COLUMN_MAX_DENSITY = 0.1;

function createIndex({
  database,
  tableName,
  columns,
  indexName,
  predicate,
  ifNotExists = false,
}: {
  database: Database.Database;
  tableName: string;
  columns: readonly string[];
  indexName: string;
  predicate?: string;
  ifNotExists?: boolean;
}): void {
  const quotedTableName = quoteSqliteIdentifier(tableName);
  const quotedIndexName = quoteSqliteIdentifier(indexName);
  const where = predicate === undefined ? '' : ` WHERE ${predicate}`;
  database
    .prepare(
      `CREATE INDEX ${ifNotExists ? 'IF NOT EXISTS ' : ''}${quotedIndexName} ON ${quotedTableName} (${columns.map(quoteSqliteIdentifier).join(', ')})${where};`,
    )
    .run();
}

function createIndexesForTable({
  database,
  tableName,
  indexes,
  ifNotExists,
}: {
  database: Database.Database;
  tableName: string;
  indexes: readonly GtfsStorageIndexPlan[];
  ifNotExists: boolean;
}): void {
  const singleColumnIndexes = indexes.filter(isSingleColumnStorageIndex);
  const compositeIndexes = indexes.filter(({ columns }) => columns.length > 1);

  if (singleColumnIndexes.length > 0) {
    const counts = database
      .prepare(
        `SELECT COUNT(*) AS rowCount, ${singleColumnIndexes
          .map(
            ({ columns }, index) =>
              `COUNT(${quoteSqliteIdentifier(columns[0])}) AS ${quoteSqliteIdentifier(`c${index}`)}`,
          )
          .join(', ')} FROM ${quoteSqliteIdentifier(tableName)}`,
      )
      .get() as { rowCount: number } & Record<string, number>;

    for (const [position, index] of singleColumnIndexes.entries()) {
      const populatedRowCount = counts[`c${position}`];
      if (populatedRowCount === undefined) {
        throw new Error(
          `SQLite did not return an index density count for ${index.name}`,
        );
      }
      const isSparse =
        counts.rowCount > 0 &&
        populatedRowCount / counts.rowCount <= SPARSE_COLUMN_MAX_DENSITY;
      createIndex({
        database,
        tableName,
        columns: index.columns,
        indexName: index.name,
        ...(isSparse
          ? {
              predicate: `${quoteSqliteIdentifier(index.columns[0])} IS NOT NULL`,
            }
          : {}),
        ifNotExists,
      });
    }
  }

  for (const index of compositeIndexes) {
    createIndex({
      database,
      tableName,
      columns: index.columns,
      indexName: index.name,
      ifNotExists,
    });
  }
}

export interface GtfsSqliteSchemaOptions extends GtfsSchemaLifecycleOptions {
  readonly database: Database.Database;
}

export function createSqliteGtfsTables(
  options: GtfsSqliteSchemaOptions,
): GtfsSchemaInspection {
  assertGtfsSchemaOptions(options, {
    method: 'createSqliteGtfsTables()',
    dialect: 'sqlite',
  });
  return applySqliteGtfsTablePlan(
    options.database,
    createGtfsStoragePlan({ dialect: 'sqlite', ...options }),
  );
}

/** @internal Applies the table phase of an already-compiled storage plan. */
export function applySqliteGtfsTablePlan(
  database: Database.Database,
  plan: GtfsStoragePlan,
): GtfsSchemaInspection {
  if (plan.dialect !== 'sqlite') {
    throw new Error('SQLite schema operations require a SQLite storage plan');
  }
  if (plan.mode === 'ensure') {
    const preflight = inspectSqliteGtfsStoragePlan(database, plan, {
      includeIndexes: false,
    });
    if (
      preflight.compatible ||
      preflight.tableIssues.some(({ missingTable }) => !missingTable)
    ) {
      return preflight;
    }
  }
  if (
    plan.mode === 'recreate' &&
    plan.tables.some(
      ({ table }) =>
        table.specification === 'tods' || table.specification === 'tods-v1',
    )
  ) {
    inspectSqliteGtfsStoragePlan(database, plan, { includeIndexes: false });
  }
  if (plan.mode !== 'validate') {
    const mode = plan.mode;
    database.transaction(() => {
      for (const tablePlan of plan.tables) {
        createTable(database, tablePlan, mode);
      }
    })();
  }

  return inspectSqliteGtfsStoragePlan(database, plan, {
    includeIndexes: plan.mode === 'validate',
  });
}

export function createSqliteGtfsIndexes(
  options: GtfsSqliteSchemaOptions,
): GtfsSchemaInspection {
  assertGtfsSchemaOptions(options, {
    method: 'createSqliteGtfsIndexes()',
    dialect: 'sqlite',
  });
  return applySqliteGtfsIndexPlan(
    options.database,
    createGtfsStoragePlan({ dialect: 'sqlite', ...options }),
  );
}

/** @internal Applies the index phase of an already-compiled storage plan. */
export function applySqliteGtfsIndexPlan(
  database: Database.Database,
  plan: GtfsStoragePlan,
  onCreateIndexes?: () => void,
): GtfsSchemaInspection {
  if (plan.dialect !== 'sqlite') {
    throw new Error('SQLite schema operations require a SQLite storage plan');
  }
  if (plan.mode !== 'validate') {
    const createdIndexes = database.transaction(() => {
      let createdIndexes = false;
      const ifNotExists = plan.mode === 'ensure';
      const existingIndexes = new Set(
        ifNotExists
          ? (
              database
                .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
                .all() as Array<{ name: string }>
            ).map(({ name }) => name)
          : [],
      );
      for (const tablePlan of plan.tables) {
        const indexes = tablePlan.indexes.filter(
          ({ name }) => !existingIndexes.has(name),
        );
        if (indexes.length > 0 && !createdIndexes) {
          onCreateIndexes?.();
        }
        createIndexesForTable({
          database,
          tableName: tablePlan.table.tableName,
          indexes,
          ifNotExists,
        });
        createdIndexes ||= indexes.length > 0;
      }
      return createdIndexes;
    })();
    if (createdIndexes) {
      database.pragma('optimize');
    }
  }

  return inspectSqliteGtfsStoragePlan(database, plan, { includeIndexes: true });
}
