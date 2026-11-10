import { assertConfigOptionKeys } from '../config/options.ts';
import { createGtfsConfigError } from '../diagnostics/errors.ts';
import { GTFS_SCHEMA_MODES } from './schema-lifecycle.ts';
import { isKyselyDatabase, isNativeSqliteDatabase } from './clients.ts';

export function assertGtfsSchemaOptions(
  options: unknown,
  {
    method,
    dialect,
    inspection = false,
  }: {
    readonly method: string;
    readonly dialect: 'sqlite' | 'kysely';
    readonly inspection?: boolean;
  },
): void {
  assertConfigOptionKeys(options, {
    name: method,
    keys: [
      'database',
      'extensions',
      ...(inspection ? ['includeIndexes'] : ['mode']),
      ...(dialect === 'kysely' ? ['dialect'] : []),
    ],
  });
  if (
    dialect === 'sqlite'
      ? !isNativeSqliteDatabase(options.database)
      : !isKyselyDatabase(options.database)
  ) {
    throw createGtfsConfigError(
      dialect === 'sqlite'
        ? `The \`${method}\` option \`database\` must be a better-sqlite3 connection`
        : `The \`${method}\` option \`database\` must be a Kysely instance`,
      { method, path: 'database' },
    );
  }
  if (
    options.includeIndexes !== undefined &&
    typeof options.includeIndexes !== 'boolean'
  ) {
    throw createGtfsConfigError(
      `The \`${method}\` option \`includeIndexes\` must be a boolean`,
      { method, path: 'includeIndexes' },
    );
  }
  if (
    options.mode !== undefined &&
    !GTFS_SCHEMA_MODES.some((mode) => mode === options.mode)
  ) {
    throw createGtfsConfigError(
      `The \`${method}\` option \`mode\` must be "ensure", "validate", or "recreate"`,
      { method, path: 'mode' },
    );
  }
  if (
    dialect === 'kysely' &&
    !['sqlite', 'postgres', 'mysql'].includes(options.dialect as string)
  ) {
    throw createGtfsConfigError(
      `The \`${method}\` option \`dialect\` must be "sqlite", "postgres", or "mysql"`,
      { method, path: 'dialect' },
    );
  }
}
