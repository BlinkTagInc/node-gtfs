import type * as tables from './tables/index.ts';
import type { GtfsDatabaseFromTables, GtfsTableName } from './define-table.ts';

type TableDefinition = (typeof tables)[keyof typeof tables];
type GtfsScheduleTableDefinition = Extract<
  TableDefinition,
  { namespace: 'gtfs-schedule' }
>;

/** SQL table names inferred from the GTFS Schedule definitions. */
export type GtfsScheduleTableName = GtfsTableName<GtfsScheduleTableDefinition>;

/** Kysely database shape inferred from every node-gtfs table manifest. */
export type GtfsDatabase = GtfsDatabaseFromTables<typeof tables>;
