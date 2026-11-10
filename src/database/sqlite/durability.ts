import type Database from 'better-sqlite3';
import { createGtfsConfigError } from '../../diagnostics/errors.ts';
import { quoteSqliteIdentifier } from './identifier.ts';
import {
  createDatabaseCleanupError,
  withSyncDatabaseCleanup,
} from '../cleanup.ts';

export const SQLITE_DURABILITY_MODES = ['safe', 'unsafe-bulk'] as const;

export type SqliteDurability = (typeof SQLITE_DURABILITY_MODES)[number];

interface SqlitePragmaSnapshot {
  readonly journalMode: string;
  readonly synchronous: number;
  readonly foreignKeys: number;
  readonly tempStore: number;
  readonly cacheSize: number;
  readonly lockingMode: string;
  readonly readUncommitted: number;
}

/** Reads the connection settings covered by the public durability contract. */
export function inspectSqlitePragmas(
  database: Database.Database,
): SqlitePragmaSnapshot {
  return {
    journalMode: database.pragma('journal_mode', { simple: true }) as string,
    synchronous: database.pragma('synchronous', { simple: true }) as number,
    foreignKeys: database.pragma('foreign_keys', { simple: true }) as number,
    tempStore: database.pragma('temp_store', { simple: true }) as number,
    cacheSize: database.pragma('cache_size', { simple: true }) as number,
    lockingMode: database.pragma('locking_mode', { simple: true }) as string,
    readUncommitted: database.pragma('read_uncommitted', {
      simple: true,
    }) as number,
  };
}

/** Applies the safe defaults only to a connection created by node-GTFS. */
export function configureOwnedSqliteConnection(
  database: Database.Database,
  path: string,
): void {
  if (path !== ':memory:') {
    database.pragma('journal_mode = WAL');
    database.pragma('synchronous = FULL');
  }

  database.pragma('foreign_keys = ON');
  database.pragma('locking_mode = NORMAL');
  database.pragma('read_uncommitted = OFF');
}

function setJournalMode(
  database: Database.Database,
  journalMode: string,
): void {
  // better-sqlite3 enables SQLite defensive mode. Temporarily disabling that
  // guard is required for the explicitly requested journal_mode = OFF only.
  database.unsafeMode(true);
  withSyncDatabaseCleanup(
    () => database.pragma(`journal_mode = ${journalMode}`),
    () => {
      database.unsafeMode(false);
    },
  );
}

/**
 * Enters the explicitly unsafe bulk-load policy and returns an idempotent
 * restoration callback. Callers must restrict this to disposable owned data.
 */
export function beginUnsafeBulkSqlite(database: Database.Database): () => void {
  // Check all user tables, not just enabled GTFS tables: disabling the journal
  // also removes recovery protection for unrelated data in this database.
  const schemas = database.pragma('database_list') as { name: string }[];
  for (const { name } of schemas) {
    const schema = quoteSqliteIdentifier(name);
    const tables = database
      .prepare(
        `SELECT name FROM ${schema}.sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*'`,
      )
      .all() as { name: string }[];
    for (const table of tables) {
      const row = database
        .prepare(
          `SELECT 1 FROM ${schema}.${quoteSqliteIdentifier(table.name)} LIMIT 1`,
        )
        .get();
      if (row !== undefined) {
        throw createGtfsConfigError(
          'Configuration option `database.durability: "unsafe-bulk"` requires an empty database; use "safe" to preserve existing data or import into a new database',
          { schema: name, table: table.name },
        );
      }
    }
  }

  const previous = inspectSqlitePragmas(database);
  let restored = false;
  const restore = () => {
    if (restored) {
      return;
    }
    setJournalMode(database, previous.journalMode);
    database.pragma(`synchronous = ${previous.synchronous}`);
    database.pragma(`foreign_keys = ${previous.foreignKeys ? 'ON' : 'OFF'}`);
    database.pragma(`locking_mode = ${previous.lockingMode}`);
    database.pragma(
      `read_uncommitted = ${previous.readUncommitted ? 'ON' : 'OFF'}`,
    );
    restored = true;
  };

  try {
    setJournalMode(database, 'OFF');
    database.pragma('synchronous = OFF');
  } catch (error: unknown) {
    try {
      restore();
    } catch (cleanupError) {
      throw createDatabaseCleanupError(error, cleanupError);
    }
    throw error;
  }

  return restore;
}
