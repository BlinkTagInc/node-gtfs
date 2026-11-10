import {
  sql,
  type ColumnDefinitionBuilder,
  type CreateTableBuilder,
  type Kysely,
} from 'kysely';

import { inspectKyselyGtfsStoragePlan } from './schema-inspector.ts';
import { assertGtfsSchemaOptions } from '../schema-options.ts';
import type {
  GtfsSchemaInspection,
  GtfsSchemaLifecycleOptions,
  GtfsSchemaMode,
} from '../schema-lifecycle.ts';
import {
  getGtfsDialectCapabilities,
  type GtfsDatabaseDialect,
} from '../dialects.ts';
import {
  createGtfsStoragePlan,
  type GtfsStorageColumnCheckPlan,
  type GtfsStorageColumnPlan,
  type GtfsStorageIndexPlan,
  type GtfsStoragePlan,
  type GtfsTableStoragePlan,
} from '../storage/plan.ts';
import { asDynamicKysely, type GtfsDynamicKysely } from '../clients.ts';

/** Options for managing a GTFS schema through caller-owned Kysely. */
export interface GtfsKyselySchemaOptions<
  DB,
> extends GtfsSchemaLifecycleOptions {
  /** Caller-owned Kysely instance. */
  readonly database: Kysely<DB>;
  readonly dialect: GtfsDatabaseDialect;
}

function columnDataType(
  column: GtfsStorageColumnPlan,
  dialect: GtfsDatabaseDialect,
):
  | 'bigint'
  | 'double precision'
  | 'integer'
  | 'text'
  | 'varchar(64)'
  | ReturnType<typeof sql.raw> {
  if (column.dataType === 'bigint') {
    return 'bigint';
  }

  if (column.dataType === 'integer' || column.dataType === 'date') {
    return 'integer';
  }

  if (column.dataType === 'real') {
    return 'double precision';
  }

  if (column.dataType === 'key-digest') {
    return 'varchar(64)';
  }

  if (!column.binaryCollation) {
    return 'text';
  }

  const collation = getGtfsDialectCapabilities(dialect).binaryTextCollation;
  return sql.raw(
    dialect === 'postgres'
      ? `text collate "${collation}"`
      : `text collate ${collation}`,
  );
}

function configureColumn(
  definition: ColumnDefinitionBuilder,
  column: GtfsStorageColumnPlan,
): ColumnDefinitionBuilder {
  let configured = definition;

  if (column.required) {
    configured = configured.notNull();
  }

  if (column.defaultValue !== undefined) {
    configured = configured.defaultTo(column.defaultValue);
  }

  return configured;
}

function kyselyCheckExpression(
  columnName: string,
  check: GtfsStorageColumnCheckPlan,
) {
  if (check.kind === 'allowed-values') {
    return sql`${sql.ref(columnName)} in (${sql.join(
      check.values.map((value) => sql.lit(value)),
    )})`;
  }
  if (check.kind === 'range') {
    if (check.minimum !== undefined && check.maximum !== undefined) {
      return sql`${sql.ref(columnName)} >= ${sql.lit(check.minimum)} and ${sql.ref(columnName)} <= ${sql.lit(check.maximum)}`;
    }
    if (check.minimum !== undefined) {
      return sql`${sql.ref(columnName)} >= ${sql.lit(check.minimum)}`;
    }
    if (check.maximum !== undefined) {
      return sql`${sql.ref(columnName)} <= ${sql.lit(check.maximum)}`;
    }
    throw new Error(`Range check for ${columnName} has no bounds`);
  }
  if (check.kind === 'exact-length') {
    return sql`length(${sql.ref(columnName)}) = ${sql.lit(check.length)}`;
  }
  return null;
}

function checkExpression(column: GtfsStorageColumnPlan) {
  const expressions = column.checks
    .map((check) => kyselyCheckExpression(column.name, check))
    .filter((expression) => expression !== null);
  if (expressions.length === 0) {
    return null;
  }
  return sql`${sql.join(expressions, sql` and `)}`;
}

async function createTable({
  database,
  tablePlan,
  dialect,
  mode,
}: {
  database: GtfsDynamicKysely;
  tablePlan: GtfsTableStoragePlan;
  dialect: GtfsDatabaseDialect;
  mode: Exclude<GtfsSchemaMode, 'validate'>;
}): Promise<void> {
  if (mode === 'recreate') {
    await database.schema
      .dropTable(tablePlan.table.tableName)
      .ifExists()
      .execute();
  }

  let table = database.schema.createTable(
    tablePlan.table.tableName,
  ) as CreateTableBuilder<string, string>;
  if (mode === 'ensure') {
    table = table.ifNotExists();
  }

  for (const column of tablePlan.columns) {
    table = table.addColumn(
      column.name,
      columnDataType(column, dialect),
      (definition) => configureColumn(definition, column),
    );

    const check = checkExpression(column);
    if (check !== null) {
      if (column.checkConstraintName === undefined) {
        throw new Error(
          `Storage column ${column.name} has checks but no constraint name`,
        );
      }
      table = table.addCheckConstraint(column.checkConstraintName, check);
    }
  }

  if (tablePlan.key.kind === 'unique') {
    table = table.addUniqueConstraint(tablePlan.key.name, [
      ...tablePlan.key.columns,
    ]);
  } else if (tablePlan.key.kind === 'primary-key') {
    table = table.addPrimaryKeyConstraint(tablePlan.key.name, [
      ...tablePlan.key.columns,
    ]);
  }

  await table.execute();
}

async function createIndex(
  database: GtfsDynamicKysely,
  tablePlan: GtfsTableStoragePlan,
  indexPlan: GtfsStorageIndexPlan,
): Promise<void> {
  let index = database.schema
    .createIndex(indexPlan.name)
    .on(tablePlan.table.tableName);

  if (indexPlan.prefixLengths.some((length) => length !== null)) {
    for (const [position, columnName] of indexPlan.columns.entries()) {
      const prefixLength = indexPlan.prefixLengths[position];
      index =
        prefixLength !== null
          ? index.column(
              sql`${sql.ref(columnName)}${sql.raw(`(${prefixLength})`)}`,
            )
          : index.column(columnName);
    }
  } else {
    index = index.columns([...indexPlan.columns]);
  }

  await index.execute();
}

export async function createKyselyGtfsTables<DB>(
  options: GtfsKyselySchemaOptions<DB>,
): Promise<GtfsSchemaInspection> {
  assertGtfsSchemaOptions(options, {
    method: 'createKyselyGtfsTables()',
    dialect: 'kysely',
  });
  return applyKyselyGtfsTablePlan(
    options.database,
    createGtfsStoragePlan(options),
  );
}

/** @internal Applies the table phase of an already-compiled storage plan. */
export async function applyKyselyGtfsTablePlan<DB>(
  database: Kysely<DB>,
  plan: GtfsStoragePlan,
): Promise<GtfsSchemaInspection> {
  const dynamicDatabase = asDynamicKysely(database);
  if (plan.mode === 'ensure') {
    const preflight = await inspectKyselyGtfsStoragePlan(database, plan, {
      includeIndexes: false,
    });
    if (preflight.tableIssues.some(({ missingTable }) => !missingTable)) {
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
    await inspectKyselyGtfsStoragePlan(database, plan, {
      includeIndexes: false,
    });
  }

  if (plan.mode !== 'validate') {
    for (const tablePlan of plan.tables) {
      await createTable({
        database: dynamicDatabase,
        tablePlan,
        dialect: plan.dialect,
        mode: plan.mode,
      });
    }
  }

  return inspectKyselyGtfsStoragePlan(database, plan, {
    includeIndexes: plan.mode === 'validate',
  });
}

export async function createKyselyGtfsIndexes<DB>(
  options: GtfsKyselySchemaOptions<DB>,
): Promise<GtfsSchemaInspection> {
  assertGtfsSchemaOptions(options, {
    method: 'createKyselyGtfsIndexes()',
    dialect: 'kysely',
  });
  return applyKyselyGtfsIndexPlan(
    options.database,
    createGtfsStoragePlan(options),
  );
}

/** @internal Applies the index phase of an already-compiled storage plan. */
export async function applyKyselyGtfsIndexPlan<DB>(
  database: Kysely<DB>,
  plan: GtfsStoragePlan,
  onCreateIndexes?: () => void,
): Promise<GtfsSchemaInspection> {
  const dynamicDatabase = asDynamicKysely(database);
  const missingIndexNames =
    plan.mode === 'ensure'
      ? new Set(
          (
            await inspectKyselyGtfsStoragePlan(database, plan, {
              includeIndexes: true,
            })
          ).tableIssues.flatMap(({ missingIndexes }) => missingIndexes),
        )
      : undefined;
  if (plan.mode !== 'validate') {
    let createdIndexes = false;
    for (const tablePlan of plan.tables) {
      for (const indexPlan of tablePlan.indexes) {
        if (!missingIndexNames || missingIndexNames.has(indexPlan.name)) {
          if (!createdIndexes) {
            onCreateIndexes?.();
          }
          await createIndex(dynamicDatabase, tablePlan, indexPlan);
          createdIndexes = true;
        }
      }
    }
    if (plan.dialect === 'sqlite' && createdIndexes) {
      await sql`PRAGMA optimize`.execute(database);
    }
  }

  return inspectKyselyGtfsStoragePlan(database, plan, { includeIndexes: true });
}
