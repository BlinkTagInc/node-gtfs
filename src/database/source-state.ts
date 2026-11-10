import { compileTable } from '../schema/compile-table.ts';
import { defineGtfsTable } from '../schema/define-table.ts';
import { compiledTables } from '../schema/table-registry.ts';
import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../diagnostics/errors.ts';

// Managed storage only: not a GTFS file, repository, or exported feed table.
export const sourceStateTable = compileTable(
  defineGtfsTable({
    filename: null,
    tableName: '_node_gtfs_source_state',
    specification: 'gtfs-schedule',
    presence: 'optional',
    primaryKey: [],
    storageKey: ['source_id'],
    keyStrategy: 'columns',
    fields: { schedule_revision: { kind: 'text' } },
  }),
);

export const realtimeTableNames = Object.freeze(
  compiledTables
    .filter((table) => table.specification === 'gtfs-realtime')
    .map((table) => table.tableName),
);

export function assertScheduleRevision(options: {
  sourceId: string;
  expected: string | null;
  actual: string | null;
}): void {
  if (options.expected !== options.actual) {
    throw new GtfsError(
      `Schedule data for source ${JSON.stringify(options.sourceId)} changed during Realtime refresh; refresh again to fetch data for the current Schedule`,
      {
        code: GtfsErrorCode.REALTIME_SCHEDULE_CHANGED,
        category: GtfsErrorCategory.DATABASE,
        details: { sourceId: options.sourceId },
      },
    );
  }
}
