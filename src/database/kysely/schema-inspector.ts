import { sql, type Kysely } from 'kysely';
import { assertGtfsSchemaOptions } from '../schema-options.ts';
import { assertTodsDatabaseVersion } from '../tods-version-policy.ts';
import {
  groupPhysicalIndexes,
  type PhysicalIndexColumn,
} from '../index-metadata.ts';
import { SQLITE_INDEX_METADATA_SQL } from '../sqlite/metadata.ts';

import type { GtfsSchemaInspection } from '../schema-lifecycle.ts';
import type { GtfsDatabaseDialect } from '../dialects.ts';
import type { GtfsExtensionSelection } from '../../schema/extensions.ts';
import {
  createGtfsStoragePlan,
  type GtfsStoragePlan,
} from '../storage/plan.ts';
import {
  compareGtfsStoragePlan,
  type GtfsPhysicalIndexMetadata,
  type GtfsPhysicalSchemaMetadata,
} from '../schema-metadata.ts';

async function getIndexes<DB>(
  database: Kysely<DB>,
  dialect: GtfsDatabaseDialect,
): Promise<GtfsPhysicalIndexMetadata[]> {
  const query =
    dialect === 'sqlite'
      ? sql.raw<PhysicalIndexColumn>(SQLITE_INDEX_METADATA_SQL)
      : dialect === 'postgres'
        ? sql<PhysicalIndexColumn>`select ix.relname as name, t.relname as table_name,
            a.attname as column_name, i.indisunique::int as is_unique,
            i.indisprimary::int as is_primary, (i.indpred is not null)::int as is_partial,
            (i.indoption[k.ordinality - 1] & 1)::int as descending, null as prefix_length
          from pg_index i join pg_class t on t.oid = i.indrelid
          join pg_namespace n on n.oid = t.relnamespace
          join pg_class ix on ix.oid = i.indexrelid
          cross join lateral unnest(i.indkey) with ordinality as k(attnum, ordinality)
          left join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
          where n.nspname = current_schema() and k.ordinality <= i.indnkeyatts
          order by t.relname, ix.relname, k.ordinality`
        : sql<PhysicalIndexColumn>`select index_name as name, table_name as table_name, column_name as column_name,
            1 - non_unique as is_unique, index_name = 'PRIMARY' as is_primary,
            0 as is_partial, collation = 'D' as descending, sub_part as prefix_length
          from information_schema.statistics where table_schema = database()
          order by table_name, index_name, seq_in_index`;
  const result = await query.execute(database);
  return groupPhysicalIndexes(result.rows);
}

async function getColumnExpressions<DB>(
  database: Kysely<DB>,
  dialect: GtfsDatabaseDialect,
): Promise<
  ReadonlyMap<string, { defaultExpression: string | null; generated: boolean }>
> {
  const query = sql<{
    table_name: string;
    column_name: string;
    column_default: string | null;
    generation_expression: string | null;
  }>`
    select table_name as table_name, column_name as column_name,
           column_default as column_default, generation_expression as generation_expression
    from information_schema.columns
    where table_schema = ${dialect === 'postgres' ? sql`current_schema()` : sql`database()`}`;
  const result = await query.execute(database);
  return new Map(
    result.rows.map((column) => [
      `${column.table_name}\0${column.column_name}`,
      {
        defaultExpression: column.column_default,
        generated:
          column.generation_expression !== null &&
          column.generation_expression !== '',
      },
    ]),
  );
}

/** Compares a Kysely database to the manifest without modifying it. */
export async function inspectKyselyGtfsSchema<DB>(
  options: Readonly<{
    database: Kysely<DB>;
    includeIndexes?: boolean;
    dialect: GtfsDatabaseDialect;
    extensions?: GtfsExtensionSelection;
  }>,
): Promise<GtfsSchemaInspection> {
  assertGtfsSchemaOptions(options, {
    method: 'inspectKyselyGtfsSchema()',
    dialect: 'kysely',
    inspection: true,
  });
  const plan = createGtfsStoragePlan({
    ...options,
  });
  return inspectKyselyGtfsStoragePlan(options.database, plan, {
    includeIndexes: options.includeIndexes ?? false,
  });
}

/** @internal Compares Kysely metadata with an already-compiled storage plan. */
export async function inspectKyselyGtfsStoragePlan<DB>(
  database: Kysely<DB>,
  plan: GtfsStoragePlan,
  options: { readonly includeIndexes: boolean },
): Promise<GtfsSchemaInspection> {
  const metadata = await readKyselyPhysicalSchemaMetadata(
    database,
    plan.dialect,
  );
  assertTodsDatabaseVersion(
    plan,
    metadata.tables.map(({ name }) => name),
  );
  return compareGtfsStoragePlan(plan, metadata, {
    includeIndexes: options.includeIndexes,
    databaseGeneratesServiceTimeColumns: false,
  });
}

export async function readKyselyPhysicalSchemaMetadata<DB>(
  database: Kysely<DB>,
  dialect: GtfsDatabaseDialect,
  options: {
    readonly includeIndexes?: boolean;
    readonly includeColumnExpressions?: boolean;
    /** SQLite: retain all table names, but inspect columns only for these tables. */
    readonly columnTableNames?: readonly string[];
  } = {},
): Promise<GtfsPhysicalSchemaMetadata> {
  if (dialect === 'sqlite') {
    const columnTableName =
      options.columnTableNames === undefined
        ? sql`tables.name`
        : options.columnTableNames.length === 0
          ? sql`null`
          : sql`case when tables.name in (${sql.join(options.columnTableNames)}) then tables.name end`;
    const result = await sql<{
      table_name: string;
      column_name: string | null;
      data_type: string;
      not_null: 0 | 1;
      default_value: unknown;
      hidden: 0 | 1 | 2 | 3;
    }>`select tables.name as table_name,
              columns.name as column_name,
              columns.type as data_type,
              columns."notnull" as not_null,
              columns.dflt_value as default_value,
              columns.hidden
          from sqlite_master as tables
          left join pragma_table_xinfo(${columnTableName}) as columns on true
          where tables.type = 'table'
          order by tables.name, columns.cid`.execute(database);
    const tables = new Map<
      string,
      GtfsPhysicalSchemaMetadata['tables'][number]['columns'][number][]
    >();
    for (const column of result.rows) {
      const columns = tables.get(column.table_name) ?? [];
      tables.set(column.table_name, columns);
      if (column.column_name === null) {
        continue;
      }
      columns.push({
        name: column.column_name,
        dataType: column.data_type,
        nullable: column.not_null === 0,
        hasDefaultValue: column.default_value !== null,
        defaultExpression:
          column.default_value === null ? null : String(column.default_value),
        generated: column.hidden === 2 || column.hidden === 3,
      });
    }
    return {
      tables: [...tables].map(([name, columns]) => ({ name, columns })),
      indexes:
        options.includeIndexes === false
          ? []
          : await getIndexes(database, dialect),
    };
  }

  const metadata = await database.introspection.getTables({
    withInternalKyselyTables: false,
  });
  const expressions =
    options.includeColumnExpressions === false
      ? undefined
      : await getColumnExpressions(database, dialect);
  return {
    tables: metadata.map((table) => ({
      name: table.name,
      columns: table.columns.map((column) => ({
        name: column.name,
        dataType: column.dataType,
        nullable: column.isNullable,
        hasDefaultValue: column.hasDefaultValue,
        defaultExpression:
          expressions?.get(`${table.name}\0${column.name}`)
            ?.defaultExpression ?? null,
        generated:
          expressions?.get(`${table.name}\0${column.name}`)?.generated ?? false,
      })),
    })),
    indexes:
      options.includeIndexes === false
        ? []
        : await getIndexes(database, dialect),
  };
}
