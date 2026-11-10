import Database from 'better-sqlite3';
import { Kysely, MysqlAdapter, PostgresAdapter, SqliteAdapter } from 'kysely';
import { createGtfsConfigError } from '../diagnostics/errors.ts';
import type { GtfsDatabaseDialect } from './dialects.ts';

export type GtfsDynamicDatabase = Record<string, Record<string, unknown>>;
export type GtfsDynamicKysely = Kysely<GtfsDynamicDatabase>;

export function asDynamicKysely<DB>(database: Kysely<DB>): GtfsDynamicKysely {
  return database as unknown as GtfsDynamicKysely;
}

export function isKyselyDatabase<DB>(value: unknown): value is Kysely<DB> {
  return value instanceof Kysely;
}

export function isNativeSqliteDatabase(
  value: unknown,
): value is Database.Database {
  return value instanceof Database;
}

export function getDatabaseClientDialect(client: unknown): GtfsDatabaseDialect {
  if (isKyselyDatabase(client)) {
    const adapter = client.getExecutor().adapter;
    if (adapter instanceof SqliteAdapter) {
      return 'sqlite';
    }
    if (adapter instanceof PostgresAdapter) {
      return 'postgres';
    }
    if (adapter instanceof MysqlAdapter) {
      return 'mysql';
    }
    throw createGtfsConfigError(
      'JavaScript configuration option `database.client` must use a supported SQLite, PostgreSQL, or MySQL Kysely adapter',
      { path: 'database.client' },
    );
  }
  if (isNativeSqliteDatabase(client)) {
    if (!client.open) {
      throw createGtfsConfigError(
        'JavaScript configuration option `database.client` is closed; provide an open SQLite connection',
        { path: 'database.client' },
      );
    }
    return 'sqlite';
  }
  throw createGtfsConfigError(
    'JavaScript configuration option `database.client` must be a Kysely instance or an open better-sqlite3 connection',
    { path: 'database.client' },
  );
}
