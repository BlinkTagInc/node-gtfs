import { createHash } from 'node:crypto';
import {
  sql,
  type ColumnDefinitionBuilder,
  type CreateTableBuilder,
  type Kysely,
} from 'kysely';

import {
  getGtfsIndexName,
  getGtfsIndexPlan,
  getPrimaryKeyColumns,
  getTimestampColumnName,
  type CompiledGtfsColumn,
  type CompiledGtfsTable,
} from '../schema/compile-table.ts';
import { fileBackedTables } from '../schema/table-registry.ts';
import type { GtfsFileWriter, GtfsFileWriterOptions } from './gtfs-writer.ts';
import type { NormalizedGtfsRow } from './gtfs-record-parser.ts';
import { applyPrefixToValue } from './feed-prefix.ts';
import { calculateSecondsFromMidnight } from './time-utils.ts';
import {
  getGtfsDialectCapabilities,
  type GtfsDatabaseDialect,
  type GtfsDialectCapabilities,
} from './database-dialects.ts';

export type KyselyImportDialect = GtfsDatabaseDialect;

/** Options for importing static GTFS into a caller-owned Kysely database. */
export interface KyselyImportOptions<DB> {
  /** Caller-owned Kysely instance. */
  db: Kysely<DB>;
  /** Kysely SQL dialect. */
  dialect: KyselyImportDialect;
  /**
   * Drop and recreate GTFS tables and indexes.
   *
   * @defaultValue true
   */
  manageSchema?: boolean;
  /** Write node-GTFS-generated columns. Defaults to `manageSchema`. */
  includeNodeGtfsExtras?: boolean;
}

type DynamicRow = Record<string, string | number | null>;
type DynamicDatabase = Record<string, DynamicRow>;
type DynamicKysely = Kysely<DynamicDatabase>;

const MYSQL_PRIMARY_KEY_HASH = '_node_gtfs_primary_key';
function asDynamicKysely<DB>(db: Kysely<DB>): DynamicKysely {
  return db as unknown as DynamicKysely;
}

function shortenIdentifier(
  identifier: string,
  capabilities: GtfsDialectCapabilities,
): string {
  if (identifier.length <= capabilities.maximumIdentifierLength) {
    return identifier;
  }

  const hash = createHash('sha256')
    .update(identifier)
    .digest('hex')
    .slice(0, 8);
  return `${identifier.slice(0, capabilities.maximumIdentifierLength - hash.length - 1)}_${hash}`;
}

function columnDataType(
  column: CompiledGtfsColumn,
): 'double precision' | 'integer' | 'text' {
  if (column.storageKind === 'integer' || column.storageKind === 'date') {
    return 'integer';
  }

  if (column.storageKind === 'real') {
    return 'double precision';
  }

  // GTFS times and serialized JSON use text on every dialect.
  return 'text';
}

function configureColumn(
  definition: ColumnDefinitionBuilder,
  column: CompiledGtfsColumn,
): ColumnDefinitionBuilder {
  let configured = definition;

  if (column.presence === 'required') {
    configured = configured.notNull();
  }

  if (column.defaultValue !== undefined) {
    configured = configured.defaultTo(column.defaultValue);
  }

  return configured;
}

function checkExpression(column: CompiledGtfsColumn) {
  if (column.sqlMinimum !== undefined && column.sqlMaximum !== undefined) {
    return sql`${sql.ref(column.name)} >= ${sql.lit(column.sqlMinimum)} and ${sql.ref(column.name)} <= ${sql.lit(column.sqlMaximum)}`;
  }

  if (column.sqlMinimum !== undefined) {
    return sql`${sql.ref(column.name)} >= ${sql.lit(column.sqlMinimum)}`;
  }

  if (column.sqlMaximum !== undefined) {
    return sql`${sql.ref(column.name)} <= ${sql.lit(column.sqlMaximum)}`;
  }

  return null;
}

async function createTable(
  db: DynamicKysely,
  tableDefinition: CompiledGtfsTable,
  dialect: KyselyImportDialect,
  includeNodeGtfsExtras: boolean,
): Promise<void> {
  const capabilities = getGtfsDialectCapabilities(dialect);
  await db.schema.dropTable(tableDefinition.name).ifExists().execute();

  let table = db.schema.createTable(tableDefinition.name) as CreateTableBuilder<
    string,
    string
  >;

  for (const column of tableDefinition.columns) {
    table = table.addColumn(column.name, columnDataType(column), (definition) =>
      configureColumn(definition, column),
    );

    const check = checkExpression(column);
    if (check) {
      table = table.addCheckConstraint(
        shortenIdentifier(
          `check_${tableDefinition.name}_${column.name}`,
          capabilities,
        ),
        check,
      );
    }

    if (includeNodeGtfsExtras && column.storageKind === 'time') {
      table = table.addColumn(getTimestampColumnName(column.name), 'integer');
    }
  }

  const keyColumns = getPrimaryKeyColumns(tableDefinition);
  if (keyColumns.length > 0) {
    if (capabilities.primaryKeyStrategy === 'hash') {
      // MySQL cannot index arbitrary-length text identifiers as a unique key.
      table = table
        .addColumn(MYSQL_PRIMARY_KEY_HASH, 'varchar(64)')
        .addUniqueConstraint(
          shortenIdentifier(
            `unique_${tableDefinition.name}_primary_key`,
            capabilities,
          ),
          [MYSQL_PRIMARY_KEY_HASH],
        );
    } else if (keyColumns.every((column) => column.presence === 'required')) {
      table = table.addPrimaryKeyConstraint(
        shortenIdentifier(`primary_${tableDefinition.name}`, capabilities),
        keyColumns.map((column) => column.name),
      );
    } else {
      // UNIQUE preserves NULL-distinct keys across SQLite and PostgreSQL.
      table = table.addUniqueConstraint(
        shortenIdentifier(
          `unique_${tableDefinition.name}_primary_key`,
          capabilities,
        ),
        keyColumns.map((column) => column.name),
      );
    }
  }

  await table.execute();
}

async function createIndex(
  db: DynamicKysely,
  dialect: KyselyImportDialect,
  tableName: string,
  columns: string[],
  tableDefinition?: CompiledGtfsTable,
): Promise<void> {
  const capabilities = getGtfsDialectCapabilities(dialect);
  let index = db.schema
    .createIndex(
      shortenIdentifier(getGtfsIndexName(tableName, columns), capabilities),
    )
    .on(tableName);

  if (capabilities.textIndexPrefixLength !== undefined) {
    const definitions = new Map(
      tableDefinition?.columns.map((column) => [column.name, column]),
    );

    for (const columnName of columns) {
      const definition = definitions.get(columnName);
      index =
        definition?.storageKind === 'text'
          ? index.column(
              sql`${sql.ref(columnName)}${sql.raw(`(${capabilities.textIndexPrefixLength})`)}`,
            )
          : index.column(columnName);
    }
  } else {
    index = index.columns(columns);
  }

  await index.execute();
}

/** Recreates managed GTFS tables. */
export async function createKyselyGtfsTables<DB>(
  options: KyselyImportOptions<DB>,
): Promise<void> {
  const db = asDynamicKysely(options.db);
  const includeNodeGtfsExtras =
    options.includeNodeGtfsExtras ?? options.manageSchema ?? true;

  for (const table of fileBackedTables) {
    await createTable(db, table, options.dialect, includeNodeGtfsExtras);
  }
}

/** Creates indexes for managed GTFS tables. */
export async function createKyselyGtfsIndexes<DB>(
  options: KyselyImportOptions<DB>,
): Promise<void> {
  const db = asDynamicKysely(options.db);
  const includeGeneratedTimeIndexes =
    options.includeNodeGtfsExtras ?? options.manageSchema ?? true;

  for (const table of fileBackedTables) {
    const { singleColumnIndexes, compositeIndexes } = getGtfsIndexPlan(table, {
      includeGeneratedTimeIndexes,
    });

    for (const columnName of singleColumnIndexes) {
      await createIndex(db, options.dialect, table.name, [columnName], table);
    }

    for (const columns of compositeIndexes) {
      await createIndex(db, options.dialect, table.name, columns, table);
    }
  }
}

function buildRow(
  row: NormalizedGtfsRow,
  options: GtfsFileWriterOptions,
  capabilities: GtfsDialectCapabilities,
  includeNodeGtfsExtras: boolean,
  includeMysqlPrimaryKeyHash: boolean,
): DynamicRow {
  const result: DynamicRow = {};
  const keyValues: Array<string | number | null> = [];

  for (let index = 0; index < options.table.columns.length; index++) {
    const column = options.table.columns[index];
    const originalValue = row[index];
    const value =
      options.prefix === undefined
        ? originalValue
        : applyPrefixToValue(
            originalValue,
            Boolean(column.applyFeedPrefix),
            options.prefix,
          );

    result[column.name] = value;

    if (column.primaryKey) {
      keyValues.push(value);
    }

    if (includeNodeGtfsExtras && column.storageKind === 'time') {
      result[getTimestampColumnName(column.name)] =
        value === null ? null : calculateSecondsFromMidnight(String(value));
    }
  }

  if (
    capabilities.primaryKeyStrategy === 'hash' &&
    includeMysqlPrimaryKeyHash &&
    keyValues.length > 0
  ) {
    result[MYSQL_PRIMARY_KEY_HASH] = keyValues.includes(null)
      ? null
      : createHash('sha256').update(JSON.stringify(keyValues)).digest('hex');
  }

  return result;
}

export function createKyselyGtfsWriter<DB>(
  databaseOptions: KyselyImportOptions<DB>,
  writerOptions: GtfsFileWriterOptions,
): GtfsFileWriter {
  const db = asDynamicKysely(databaseOptions.db);
  const capabilities = getGtfsDialectCapabilities(databaseOptions.dialect);
  const managedSchema = databaseOptions.manageSchema ?? true;
  const includeNodeGtfsExtras =
    databaseOptions.includeNodeGtfsExtras ?? managedSchema;
  const includeMysqlPrimaryKeyHash =
    managedSchema || databaseOptions.includeNodeGtfsExtras === true;

  return {
    async writeBatch(batch) {
      if (batch.table.name !== writerOptions.table.name) {
        throw new Error(
          `Writer for ${writerOptions.table.name} received a batch for ${batch.table.name}`,
        );
      }
      const rows = batch.rows;
      const insertColumnCount =
        writerOptions.table.columns.length +
        (includeNodeGtfsExtras
          ? writerOptions.table.columns.filter(
              (column) => column.storageKind === 'time',
            ).length
          : 0) +
        (capabilities.primaryKeyStrategy === 'hash' &&
        includeMysqlPrimaryKeyHash &&
        getPrimaryKeyColumns(writerOptions.table).length > 0
          ? 1
          : 0);
      const chunkSize = Math.max(
        1,
        Math.min(
          capabilities.maximumRowsPerInsert,
          Math.floor(
            capabilities.maximumParametersPerInsert / insertColumnCount,
          ),
        ),
      );

      await db.transaction().execute(async (transaction) => {
        for (let offset = 0; offset < rows.length; offset += chunkSize) {
          const values = rows
            .slice(offset, offset + chunkSize)
            .map((row) =>
              buildRow(
                row,
                writerOptions,
                capabilities,
                includeNodeGtfsExtras,
                includeMysqlPrimaryKeyHash,
              ),
            );

          let insert = transaction
            .insertInto(writerOptions.table.name)
            .values(values);

          if (writerOptions.ignoreDuplicates) {
            if (capabilities.duplicateStrategy === 'conflict') {
              insert = insert.onConflict((conflict) => conflict.doNothing());
            } else if (capabilities.duplicateStrategy === 'duplicate-key') {
              const firstColumn = writerOptions.table.columns[0].name;
              insert = insert.onDuplicateKeyUpdate({
                [firstColumn]: sql.ref(firstColumn),
              });
            } else {
              insert = insert.orIgnore();
            }
          }

          await insert.execute();
        }
      });
    },
  };
}
