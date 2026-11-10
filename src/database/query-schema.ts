import type { Kysely } from 'kysely';

import type { CompiledGtfsTable } from '../schema/compile-table.ts';
import type { GtfsDatabaseDialect } from './dialects.ts';
import { readKyselyPhysicalSchemaMetadata } from './kysely/schema-inspector.ts';
import { assertCompatibleGtfsSchema } from './schema-lifecycle.ts';
import { compareGtfsStoragePlan } from './schema-metadata.ts';
import { createGtfsStoragePlan } from './storage/plan.ts';
import { assertTodsDatabaseVersion } from './tods-version-policy.ts';

/** Inspect once per read operation; never reuse metadata across operations. */
export async function validateGtfsQuerySchema<DB>(options: {
  readonly database: Kysely<DB>;
  readonly dialect: GtfsDatabaseDialect;
  readonly tables: readonly CompiledGtfsTable[];
  readonly requiredColumns?: ReadonlyMap<string, ReadonlySet<string>>;
}): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
  const { database, dialect, tables } = options;
  const storagePlan = createGtfsStoragePlan({
    dialect,
    tables: [...new Set(tables)],
  });
  const plan = {
    ...storagePlan,
    tables: storagePlan.tables.map((table) => {
      const required = options.requiredColumns?.get(table.table.tableName);
      const columns = table.columns.filter(
        (column) =>
          column.role === 'manifest' ||
          column.role === 'source-id' ||
          required?.has(column.name),
      );
      return {
        ...table,
        columns,
        columnNames: columns.map(({ name }) => name),
      };
    }),
  };
  const metadata = await readKyselyPhysicalSchemaMetadata(database, dialect, {
    includeIndexes: false,
    includeColumnExpressions: false,
    columnTableNames: plan.tables.map(({ table }) => table.tableName),
  });
  assertTodsDatabaseVersion(
    plan,
    metadata.tables.map(({ name }) => name),
  );
  await assertCompatibleGtfsSchema(
    compareGtfsStoragePlan(plan, metadata, {
      includeIndexes: false,
      purpose: 'query',
    }),
    { database, dialect },
  );
  const availableColumns = new Map(
    metadata.tables.map((table) => [
      table.name,
      new Set(table.columns.map(({ name }) => name)),
    ]),
  );
  return availableColumns;
}
