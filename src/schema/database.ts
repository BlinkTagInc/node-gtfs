import type * as tables from './tables/index.ts';
import type { GtfsDatabaseFromTables, GtfsTableName } from './define-table.ts';

type TableDefinition = (typeof tables)[keyof typeof tables];
type GtfsScheduleTableDefinition = Extract<
  TableDefinition,
  { namespace: 'gtfs-schedule' }
>;
type GtfsFileBackedTableDefinition = Extract<TableDefinition, { file: string }>;

/** SQL table names inferred from the GTFS Schedule definitions. */
export type GtfsScheduleTableName = GtfsTableName<GtfsScheduleTableDefinition>;

/** SQL table names inferred from every file-backed GTFS definition. */
export type GtfsFileBackedTableName =
  GtfsTableName<GtfsFileBackedTableDefinition>;

/** Kysely database shape inferred from every node-gtfs table manifest. */
export type GtfsDatabase = GtfsDatabaseFromTables<typeof tables>;
