import {
  DummyDriver,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type Dialect,
} from 'kysely';
import type { GtfsDatabaseDialect } from '../../src/database/dialects.ts';

export function createDummyDialect(dialect: GtfsDatabaseDialect): Dialect {
  if (dialect === 'postgres') {
    return {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (database) => new PostgresIntrospector(database),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    };
  }
  if (dialect === 'mysql') {
    return {
      createAdapter: () => new MysqlAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (database) => new MysqlIntrospector(database),
      createQueryCompiler: () => new MysqlQueryCompiler(),
    };
  }
  return {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (database) => new SqliteIntrospector(database),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  };
}
