import {
  addConfigIssue,
  type ConfigValidationContext as ValidationContext,
} from './validation.ts';
import type { ResolvedGtfsDatabaseConfig } from './resolved.ts';
import { getDatabaseClientDialect } from '../database/clients.ts';
import { isGtfsError } from '../diagnostics/errors.ts';
import type { GtfsDatabaseDialect } from '../database/dialects.ts';
import { DEFAULT_GTFS_DATABASE_CONFIG } from './defaults.ts';
import {
  readConfigObject,
  validateKnownConfigKeys,
  readConfigEnum,
  readConfigString,
} from './readers.ts';
const KNOWN_KEYS = {
  database: ['path', 'client', 'durability', 'dialect'],
} as const;

export function resolveDatabase<DB>(
  value: unknown,
  context: ValidationContext,
): ResolvedGtfsDatabaseConfig<DB> | undefined {
  const database = readConfigObject(value, 'database', context, true) ?? {};
  validateKnownConfigKeys(database, 'database', KNOWN_KEYS.database, context);
  if (Object.hasOwn(database, 'dialect')) {
    addConfigIssue(
      context,
      'unknown-option',
      'database.dialect',
      'Configuration option `database.dialect` was removed; a supplied `database.client` determines the database type, and `database.path` opens SQLite',
    );
  }
  const path = readConfigString(database.path, 'database.path', context);
  const client = database.client;
  const durability = readConfigEnum(
    database.durability,
    'database.durability',
    context,
    ['safe', 'unsafe-bulk'] as const,
    DEFAULT_GTFS_DATABASE_CONFIG.durability,
  );

  if (context.format === 'json' && client !== undefined) {
    addConfigIssue(
      context,
      'invalid-combination',
      'database.client',
      'Configuration option `database.client` is available only in JavaScript configuration',
    );
  }
  if (path !== undefined && client !== undefined) {
    addConfigIssue(
      context,
      'invalid-combination',
      'database',
      'Configuration options `database.path` and `database.client` are mutually exclusive',
    );
  }
  if (database.durability !== undefined && client !== undefined) {
    addConfigIssue(
      context,
      'invalid-combination',
      'database.durability',
      'Configuration option `database.durability` is supported only for an owned SQLite database',
    );
  }
  if (
    context.operation === 'import' &&
    client === undefined &&
    (database.path === undefined || path?.trim() === '')
  ) {
    addConfigIssue(
      context,
      database.path === undefined ? 'missing-value' : 'invalid-value',
      'database.path',
      'Standalone Schedule import requires an explicit `database.path` or a caller-owned `database.client`; set a file path to keep imported data, or explicitly use ":memory:" to discard it when import completes',
    );
  }

  if (client !== undefined) {
    let dialect: GtfsDatabaseDialect;
    try {
      dialect = getDatabaseClientDialect(client);
    } catch (error) {
      if (!isGtfsError(error)) {
        throw error;
      }
      addConfigIssue(
        context,
        'invalid-value',
        'database.client',
        error.message,
      );
      return undefined;
    }
    return Object.freeze({ dialect, client }) as ResolvedGtfsDatabaseConfig<DB>;
  }
  return Object.freeze({
    dialect: 'sqlite',
    path: path ?? DEFAULT_GTFS_DATABASE_CONFIG.path,
    durability,
  });
}
