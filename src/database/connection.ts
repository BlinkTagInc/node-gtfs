import type Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import type { GtfsDatabaseConfig } from '../types/config.ts';
import { DEFAULT_GTFS_DATABASE_CONFIG } from '../config/defaults.ts';
import {
  getDatabaseClientDialect,
  isKyselyDatabase,
  isNativeSqliteDatabase,
} from './clients.ts';
import { createOwnedSqliteDatabase } from './sqlite/connection.ts';
import { withDatabaseCleanup } from './cleanup.ts';

export type GtfsConnectionOwnership = 'owned' | 'borrowed';

interface InitializedGtfsConnection<DB> {
  readonly database: Kysely<DB>;
  readonly sqlite: Database.Database | null;
  readonly databaseDescription: string;
  readonly ownership: GtfsConnectionOwnership;
}

export async function closeOwnedGtfsConnection<DB>(
  connection: Pick<
    InitializedGtfsConnection<DB>,
    'database' | 'sqlite' | 'ownership'
  >,
): Promise<void> {
  if (connection.ownership === 'owned') {
    await withDatabaseCleanup(
      () => connection.database.destroy(),
      () => {
        if (connection.sqlite?.open) {
          connection.sqlite.close();
        }
      },
    );
  }
}

export function initializeGtfsConnection<DB>(
  config: Readonly<GtfsDatabaseConfig<DB>>,
): InitializedGtfsConnection<DB> {
  const dialect =
    config.client === undefined
      ? 'sqlite'
      : getDatabaseClientDialect(config.client);
  if (isKyselyDatabase<DB>(config.client)) {
    return Object.freeze({
      database: config.client,
      sqlite: null,
      databaseDescription: `${dialect} Kysely database`,
      ownership: 'borrowed',
    });
  }

  if (isNativeSqliteDatabase(config.client)) {
    return Object.freeze({
      database: new Kysely<DB>({
        dialect: new SqliteDialect({ database: config.client }),
      }),
      sqlite: config.client,
      databaseDescription: `SQLite database at ${config.client.name}`,
      ownership: 'borrowed',
    });
  }

  const path = config.path ?? DEFAULT_GTFS_DATABASE_CONFIG.path;
  const sqlite = createOwnedSqliteDatabase(path);
  return Object.freeze({
    database: new Kysely<DB>({
      dialect: new SqliteDialect({ database: sqlite }),
    }),
    sqlite,
    databaseDescription: `SQLite database at ${path}`,
    ownership: 'owned',
  });
}
