import type Database from 'better-sqlite3';
import { assertGtfsSchemaOptions } from '../schema-options.ts';
import { assertTodsDatabaseVersion } from '../tods-version-policy.ts';
import { readSqliteGeneratedExpression } from './expressions.ts';
import {
  groupPhysicalIndexes,
  type PhysicalIndexColumn,
} from '../index-metadata.ts';
import { SQLITE_INDEX_METADATA_SQL } from './metadata.ts';

import type { GtfsExtensionSelection } from '../../schema/extensions.ts';
import type { GtfsSchemaInspection } from '../schema-lifecycle.ts';
import { quoteSqliteIdentifier } from './identifier.ts';
import {
  createGtfsStoragePlan,
  type GtfsStoragePlan,
} from '../storage/plan.ts';
import {
  compareGtfsStoragePlan,
  type GtfsPhysicalSchemaMetadata,
} from '../schema-metadata.ts';

interface SqliteColumnMetadata {
  readonly name: string;
  readonly type: string;
  readonly notnull: 0 | 1;
  readonly dflt_value: unknown;
  readonly hidden: 0 | 1 | 2 | 3;
}

/** Compares a SQLite database to the manifest without modifying it. */
export function inspectSqliteGtfsSchema(
  options: Readonly<{
    database: Database.Database;
    includeIndexes?: boolean;
    extensions?: GtfsExtensionSelection;
  }>,
): GtfsSchemaInspection {
  assertGtfsSchemaOptions(options, {
    method: 'inspectSqliteGtfsSchema()',
    dialect: 'sqlite',
    inspection: true,
  });
  const plan = createGtfsStoragePlan({
    dialect: 'sqlite',
    ...options,
  });
  return inspectSqliteGtfsStoragePlan(options.database, plan, {
    includeIndexes: options.includeIndexes ?? false,
  });
}

/** @internal Compares SQLite with an already-compiled storage plan. */
export function inspectSqliteGtfsStoragePlan(
  database: Database.Database,
  plan: GtfsStoragePlan,
  options: { readonly includeIndexes: boolean },
): GtfsSchemaInspection {
  return compareGtfsStoragePlan(
    plan,
    readSqlitePhysicalSchemaMetadata(database, plan),
    options,
  );
}

function readSqlitePhysicalSchemaMetadata(
  database: Database.Database,
  plan: GtfsStoragePlan,
): GtfsPhysicalSchemaMetadata {
  const tableDefinitions = new Map(
    (
      database
        .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table'")
        .all() as Array<{ name: string; sql: string }>
    ).map(({ name, sql }) => [name, sql]),
  );
  assertTodsDatabaseVersion(plan, tableDefinitions.keys());
  const tables = plan.tables
    .filter(({ table }) => tableDefinitions.has(table.tableName))
    .map(({ table }) => ({
      name: table.tableName,
      columns: (
        database
          .prepare(
            `PRAGMA table_xinfo(${quoteSqliteIdentifier(table.tableName)})`,
          )
          .all() as SqliteColumnMetadata[]
      ).map((column) => ({
        name: column.name,
        dataType: column.type,
        nullable: column.notnull === 0,
        hasDefaultValue: column.dflt_value !== null,
        defaultExpression:
          column.dflt_value === null ? null : String(column.dflt_value),
        generated: column.hidden === 2 || column.hidden === 3,
        generatedExpression:
          column.hidden === 2 || column.hidden === 3
            ? readSqliteGeneratedExpression(
                tableDefinitions.get(table.tableName) ?? '',
                column.name,
              )
            : null,
      })),
    }));
  const indexes = groupPhysicalIndexes(
    database.prepare(SQLITE_INDEX_METADATA_SQL).all() as PhysicalIndexColumn[],
  );

  return { tables, indexes };
}
