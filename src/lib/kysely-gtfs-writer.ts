import { createHash } from 'node:crypto';
import {
  sql,
  type ColumnDefinitionBuilder,
  type CreateTableBuilder,
  type Kysely,
} from 'kysely';

import * as models from '../models/models.ts';
import type { Model, ModelColumn } from '../types/global_interfaces.ts';
import type { GtfsFileWriter, GtfsFileWriterOptions } from './gtfs-writer.ts';
import type { NormalizedGtfsRow } from './gtfs-record-parser.ts';
import {
  applyPrefixToValue,
  calculateSecondsFromMidnight,
  getTimestampColumnName,
} from './utils.ts';

export type KyselyImportDialect = 'mysql' | 'postgres' | 'sqlite';

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
  /** Write generated `*_timestamp` columns. Defaults to `manageSchema`. */
  includeNodeGtfsExtras?: boolean;
}

type DynamicRow = Record<string, string | number | null>;
type DynamicDatabase = Record<string, DynamicRow>;
type DynamicKysely = Kysely<DynamicDatabase>;

const MYSQL_PRIMARY_KEY_HASH = '_node_gtfs_primary_key';
const MAX_IDENTIFIER_LENGTH = 63;
const MAX_INSERT_CHUNK_SIZE = 1_000;
const MAX_PARAMETERS_PER_INSERT = 60_000;

function asDynamicKysely<DB>(db: Kysely<DB>): DynamicKysely {
  return db as unknown as DynamicKysely;
}

function shortenIdentifier(identifier: string): string {
  if (identifier.length <= MAX_IDENTIFIER_LENGTH) {
    return identifier;
  }

  const hash = createHash('sha256')
    .update(identifier)
    .digest('hex')
    .slice(0, 8);
  return `${identifier.slice(0, MAX_IDENTIFIER_LENGTH - hash.length - 1)}_${hash}`;
}

function columnDataType(
  column: ModelColumn,
): 'double precision' | 'integer' | 'text' {
  if (column.type === 'integer' || column.type === 'date') {
    return 'integer';
  }

  if (column.type === 'real') {
    return 'double precision';
  }

  // GTFS times and serialized JSON use text on every dialect.
  return 'text';
}

function configureColumn(
  definition: ColumnDefinitionBuilder,
  column: ModelColumn,
): ColumnDefinitionBuilder {
  let configured = definition;

  if (column.required) {
    configured = configured.notNull();
  }

  if (column.default !== undefined) {
    configured = configured.defaultTo(column.default);
  }

  return configured;
}

function primaryColumns(model: Model): ModelColumn[] {
  return model.schema.filter((column) => column.primary);
}

function checkExpression(column: ModelColumn) {
  if (column.min !== undefined && column.max !== undefined) {
    return sql`${sql.ref(column.name)} >= ${sql.lit(column.min)} and ${sql.ref(column.name)} <= ${sql.lit(column.max)}`;
  }

  if (column.min !== undefined) {
    return sql`${sql.ref(column.name)} >= ${sql.lit(column.min)}`;
  }

  if (column.max !== undefined) {
    return sql`${sql.ref(column.name)} <= ${sql.lit(column.max)}`;
  }

  return null;
}

async function createTable(
  db: DynamicKysely,
  model: Model,
  dialect: KyselyImportDialect,
  includeNodeGtfsExtras: boolean,
): Promise<void> {
  await db.schema.dropTable(model.filenameBase).ifExists().execute();

  let table = db.schema.createTable(model.filenameBase) as CreateTableBuilder<
    string,
    string
  >;

  for (const column of model.schema) {
    table = table.addColumn(column.name, columnDataType(column), (definition) =>
      configureColumn(definition, column),
    );

    const check = checkExpression(column);
    if (check) {
      table = table.addCheckConstraint(
        shortenIdentifier(`check_${model.filenameBase}_${column.name}`),
        check,
      );
    }

    if (includeNodeGtfsExtras && column.type === 'time') {
      table = table.addColumn(getTimestampColumnName(column.name), 'integer');
    }
  }

  const keyColumns = primaryColumns(model);
  if (keyColumns.length > 0) {
    if (dialect === 'mysql') {
      // MySQL cannot index arbitrary-length text identifiers as a unique key.
      table = table
        .addColumn(MYSQL_PRIMARY_KEY_HASH, 'varchar(64)')
        .addUniqueConstraint(
          shortenIdentifier(`unique_${model.filenameBase}_primary_key`),
          [MYSQL_PRIMARY_KEY_HASH],
        );
    } else if (keyColumns.every((column) => column.required)) {
      table = table.addPrimaryKeyConstraint(
        shortenIdentifier(`primary_${model.filenameBase}`),
        keyColumns.map((column) => column.name),
      );
    } else {
      // UNIQUE preserves NULL-distinct keys across SQLite and PostgreSQL.
      table = table.addUniqueConstraint(
        shortenIdentifier(`unique_${model.filenameBase}_primary_key`),
        keyColumns.map((column) => column.name),
      );
    }
  }

  await table.execute();
}

const ADDITIONAL_INDEXES: Record<string, string[][]> = {
  calendar_dates: [['date', 'exception_type', 'service_id']],
  stop_times: [['stop_id', 'trip_id', 'stop_sequence']],
  trips: [['route_id', 'service_id', 'trip_id']],
};

async function createIndex(
  db: DynamicKysely,
  dialect: KyselyImportDialect,
  tableName: string,
  columns: string[],
): Promise<void> {
  let index = db.schema
    .createIndex(shortenIdentifier(`idx_${tableName}_${columns.join('_')}`))
    .on(tableName);

  if (dialect === 'mysql') {
    const model = Object.values(models).find(
      (candidate) => candidate.filenameBase === tableName,
    ) as Model | undefined;
    const definitions = new Map(
      model?.schema.map((column) => [column.name, column]),
    );

    for (const columnName of columns) {
      const definition = definitions.get(columnName);
      index =
        definition?.type === 'text'
          ? index.column(sql`${sql.ref(columnName)}${sql.raw('(191)')}`)
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

  for (const model of Object.values(models) as Model[]) {
    if (model.schema && model.extension !== 'gtfs-realtime') {
      await createTable(db, model, options.dialect, includeNodeGtfsExtras);
    }
  }
}

/** Creates indexes for managed GTFS tables. */
export async function createKyselyGtfsIndexes<DB>(
  options: KyselyImportOptions<DB>,
): Promise<void> {
  const db = asDynamicKysely(options.db);

  for (const model of Object.values(models) as Model[]) {
    if (model.extension === 'gtfs-realtime') {
      continue;
    }

    const indexedColumns = model.schema.flatMap((column) => {
      const columns: string[] = [];

      if (column.index) {
        columns.push(column.name);
      }

      if (column.type === 'time') {
        if (options.includeNodeGtfsExtras ?? options.manageSchema ?? true) {
          columns.push(getTimestampColumnName(column.name));
        }
      }

      return columns;
    });

    for (const columnName of indexedColumns) {
      await createIndex(db, options.dialect, model.filenameBase, [columnName]);
    }
  }

  for (const [tableName, indexes] of Object.entries(ADDITIONAL_INDEXES)) {
    for (const columns of indexes) {
      await createIndex(db, options.dialect, tableName, columns);
    }
  }
}

function buildRow(
  row: NormalizedGtfsRow,
  options: GtfsFileWriterOptions,
  dialect: KyselyImportDialect,
  includeNodeGtfsExtras: boolean,
  managedSchema: boolean,
): DynamicRow {
  const result: DynamicRow = {};
  const keyValues: Array<string | null> = [];

  for (let index = 0; index < options.model.schema.length; index++) {
    const column = options.model.schema[index];
    const originalValue = row[index];
    const value =
      options.prefix === undefined
        ? originalValue
        : applyPrefixToValue(
            originalValue as string,
            Boolean(column.prefix),
            options.prefix,
          );

    result[column.name] = value;

    if (column.primary) {
      keyValues.push(value);
    }

    if (includeNodeGtfsExtras && column.type === 'time') {
      result[getTimestampColumnName(column.name)] =
        value === null ? null : calculateSecondsFromMidnight(value);
    }
  }

  if (dialect === 'mysql' && managedSchema && keyValues.length > 0) {
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
  const managedSchema = databaseOptions.manageSchema ?? true;
  const includeNodeGtfsExtras =
    databaseOptions.includeNodeGtfsExtras ?? managedSchema;

  return {
    async writeBatch(rows) {
      const insertColumnCount =
        writerOptions.model.schema.length +
        (includeNodeGtfsExtras
          ? writerOptions.model.schema.filter(
              (column) => column.type === 'time',
            ).length
          : 0) +
        (databaseOptions.dialect === 'mysql' &&
        managedSchema &&
        primaryColumns(writerOptions.model).length > 0
          ? 1
          : 0);
      const chunkSize = Math.max(
        1,
        Math.min(
          MAX_INSERT_CHUNK_SIZE,
          Math.floor(MAX_PARAMETERS_PER_INSERT / insertColumnCount),
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
                databaseOptions.dialect,
                includeNodeGtfsExtras,
                managedSchema,
              ),
            );

          let insert = transaction
            .insertInto(writerOptions.model.filenameBase)
            .values(values);

          if (writerOptions.ignoreDuplicates) {
            if (databaseOptions.dialect === 'postgres') {
              insert = insert.onConflict((conflict) => conflict.doNothing());
            } else if (databaseOptions.dialect === 'mysql') {
              const firstColumn = writerOptions.model.schema[0].name;
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
