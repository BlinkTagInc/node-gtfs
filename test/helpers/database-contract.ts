import { test } from 'node:test';
import Database from 'better-sqlite3';
import {
  Kysely,
  MysqlDialect,
  PostgresDialect,
  SqliteDialect,
  type Driver,
} from 'kysely';
import mysql from 'mysql2';
import pg from 'pg';
import Cursor from 'pg-cursor';
import type { ConformanceDatabase } from '../contracts/cases/database-types.ts';

type Dialect = 'sqlite' | 'postgres' | 'mysql';

export function openContractDatabase(
  dialect: Dialect,
  log = () => {},
  configureDriver?: (driver: Driver) => void,
) {
  const url =
    process.env[
      dialect === 'postgres' ? 'GTFS_TEST_POSTGRES_URL' : 'GTFS_TEST_MYSQL_URL'
    ];
  if (dialect !== 'sqlite' && !url) {
    throw new Error(`Missing ${dialect} test database URL`);
  }
  const implementation =
    dialect === 'sqlite'
      ? new SqliteDialect({ database: new Database(':memory:') })
      : dialect === 'postgres'
        ? new PostgresDialect({
            // A leaked stream must not be hidden by another pooled connection.
            pool: new pg.Pool({ connectionString: url, max: 1 }),
            cursor: Cursor,
          })
        : new MysqlDialect({
            pool: mysql.createPool({ uri: url!, connectionLimit: 1 }),
          });
  return new Kysely<ConformanceDatabase>({
    dialect: {
      createDriver() {
        const driver = implementation.createDriver();
        configureDriver?.(driver);
        return driver;
      },
      createAdapter: () => implementation.createAdapter(),
      createQueryCompiler: () => implementation.createQueryCompiler(),
      createIntrospector: (database) =>
        implementation.createIntrospector(database),
    },
    log,
  });
}

/** Register the same behavioral assertion against real, disposable databases. */
export function databaseContract(
  name: string,
  verify: (context: {
    db: Kysely<ConformanceDatabase>;
    dialect: Dialect;
    queryCount: () => number;
  }) => Promise<void>,
  dialects: readonly Dialect[] = ['sqlite', 'postgres', 'mysql'],
) {
  for (const dialect of dialects) {
    const variable =
      dialect === 'postgres' ? 'GTFS_TEST_POSTGRES_URL' : 'GTFS_TEST_MYSQL_URL';
    test(
      `${dialect}: ${name}`,
      {
        skip:
          dialect !== 'sqlite' && !process.env[variable]
            ? `${variable} is not set`
            : false,
        timeout: 60_000,
      },
      async () => {
        let count = 0;
        const db = openContractDatabase(dialect, () => {
          count += 1;
        });
        try {
          await verify({ db, dialect, queryCount: () => count });
        } finally {
          await db.destroy();
        }
      },
    );
  }
}
