import type * as tables from './tables/index.ts';
import type { GtfsDatabaseFromTables, GtfsTableName } from './define-table.ts';

type TableDefinition = (typeof tables)[keyof typeof tables];
type GtfsScheduleTableDefinition = Extract<
  TableDefinition,
  { specification: 'gtfs-schedule' }
>;
type GtfsFileBackedTableDefinition = Extract<
  TableDefinition,
  { filename: string }
>;

export type GtfsScheduleTableName = GtfsTableName<GtfsScheduleTableDefinition>;

export type GtfsFileBackedTableName =
  GtfsTableName<GtfsFileBackedTableDefinition>;

export type GtfsFileBackedFilename = GtfsFileBackedTableDefinition['filename'];

/** Kysely database shape inferred from every node-gtfs table manifest. */
export type GtfsDatabase = GtfsDatabaseFromTables<typeof tables>;
