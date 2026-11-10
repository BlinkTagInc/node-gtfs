import type Database from 'better-sqlite3';
import type { Kysely } from 'kysely';
import type { createKyselyGtfsWriter } from '../../src/database/kysely/schedule-writer.ts';
import type { createSqliteGtfsWriter } from '../../src/database/sqlite/schedule-writer.ts';
import type { GtfsScheduleWriterOptions } from '../../src/schedule/import/writer.ts';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Value extends true> = Value;

type TestDatabase = { agency: { source_id: string; agency_id: string } };
type KyselyArguments = Parameters<typeof createKyselyGtfsWriter<TestDatabase>>;
type SqliteArguments = Parameters<typeof createSqliteGtfsWriter>;

export type KyselyWriterTakesOneNamedOptionsObject = Assert<
  Equal<KyselyArguments, [GtfsScheduleWriterOptions<Kysely<TestDatabase>>]>
>;
export type SqliteWriterTakesOneNamedOptionsObject = Assert<
  Equal<SqliteArguments['length'], 1>
>;
export type SqliteWriterSharesOptionsWithDatabaseFilenameForErrors = Assert<
  Equal<
    Omit<SqliteArguments[0], 'databasePath'>,
    GtfsScheduleWriterOptions<Database.Database>
  >
>;
export type KyselyWriterHasNoSchemaManagementOptions = Assert<
  Equal<
    Extract<keyof KyselyArguments[0], 'dialect' | 'mode' | 'extensions'>,
    never
  >
>;
