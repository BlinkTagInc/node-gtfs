import Database from 'better-sqlite3';
import { sql, type QueryExecutorProvider } from 'kysely';

import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../diagnostics/errors.ts';
import type { GtfsExtensionOptions } from '../schema/extensions.ts';
import type { GtfsDatabaseDialect } from './dialects.ts';

export const GTFS_SCHEMA_MODES = ['ensure', 'validate', 'recreate'] as const;

export type GtfsSchemaMode = (typeof GTFS_SCHEMA_MODES)[number];

export interface GtfsColumnTypeIssue {
  readonly columnName: string;
  readonly expectedType: 'bigint' | 'integer' | 'real' | 'text';
  readonly actualType: string;
}

export interface GtfsTableSchemaIssue {
  readonly tableName: string;
  readonly missingTable: boolean;
  readonly missingColumns: readonly string[];
  readonly unexpectedlyNullableColumns: readonly string[];
  readonly missingDefaultColumns: readonly string[];
  readonly missingIndexes: readonly string[];
  readonly incompatibleColumnTypes: readonly GtfsColumnTypeIssue[];
  readonly incompatibleGeneratedColumns: readonly string[];
  readonly incompatibleDefaults?: readonly string[];
  readonly incompatibleIndexes?: readonly string[];
  readonly incompatibleStorageKey?: boolean;
}

export interface GtfsSchemaInspection {
  readonly compatible: boolean;
  readonly tableIssues: readonly GtfsTableSchemaIssue[];
}

export interface GtfsSchemaLifecycleOptions extends GtfsExtensionOptions {
  /** Schema behavior. Defaults to `ensure`. */
  readonly mode?: GtfsSchemaMode;
}

export interface GtfsSchemaDatabaseContext {
  readonly database: Database.Database | QueryExecutorProvider;
  readonly dialect: GtfsDatabaseDialect;
}

async function describeSchemaDatabase({
  database,
  dialect,
}: GtfsSchemaDatabaseContext): Promise<{
  description: string;
  path?: string;
  databaseName?: string;
}> {
  const label = { sqlite: 'SQLite', postgres: 'PostgreSQL', mysql: 'MySQL' }[
    dialect
  ];
  try {
    if (dialect === 'sqlite') {
      const rows =
        database instanceof Database
          ? (database.pragma('database_list') as {
              name: string;
              file: string;
            }[])
          : (
              await sql<{
                name: string;
                file: string;
              }>`PRAGMA database_list`.execute(database)
            ).rows;
      const file = rows.find((row) => row.name === 'main')?.file;
      if (file) {
        return {
          description: `existing SQLite database at ${JSON.stringify(file)}`,
          path: file,
        };
      }
      return { description: 'SQLite database (in-memory or temporary)' };
    }
    if (!(database instanceof Database)) {
      const query =
        dialect === 'postgres'
          ? sql<{ name: string }>`SELECT current_database() AS name`
          : sql<{ name: string }>`SELECT DATABASE() AS name`;
      const name = (await query.execute(database)).rows[0]?.name;
      if (name) {
        return {
          description: `existing ${label} database ${JSON.stringify(name)}`,
          databaseName: name,
        };
      }
    }
  } catch {
    // A failed diagnostic lookup must not hide the schema incompatibility.
  }
  return { description: `${label} database` };
}

export async function assertCompatibleGtfsSchema(
  inspection: GtfsSchemaInspection,
  context: GtfsSchemaDatabaseContext,
): Promise<void> {
  if (inspection.compatible) {
    return;
  }

  const { description, ...databaseDetails } =
    await describeSchemaDatabase(context);
  const summary = `The ${description} has an incompatible GTFS schema`;
  const firstIssue = inspection.tableIssues.at(0);
  const message =
    firstIssue === undefined
      ? summary
      : firstIssue.missingTable
        ? `${summary}: enabled table ${JSON.stringify(firstIssue.tableName)} is missing`
        : `${summary}: table ${JSON.stringify(firstIssue.tableName)} has an unexpected structure`;

  throw new GtfsError(message, {
    code: GtfsErrorCode.SCHEMA_INVALID,
    category: GtfsErrorCategory.DATABASE,
    details: {
      schema: inspection,
      databaseDialect: context.dialect,
      ...databaseDetails,
    },
  });
}
