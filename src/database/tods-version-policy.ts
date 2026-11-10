import { compiledTables } from '../schema/table-registry.ts';
import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../diagnostics/errors.ts';
import type { GtfsStoragePlan } from './storage/plan.ts';

/** A database's physical tables must not mix the two TODS formats. */
export function assertTodsDatabaseVersion(
  plan: GtfsStoragePlan,
  existingTableNames: Iterable<string>,
): void {
  const requestedVersions = new Set(
    plan.tables.map(({ table }) => table.specification),
  );
  const version = requestedVersions.has('tods')
    ? 'tods'
    : requestedVersions.has('tods-v1')
      ? 'tods-v1'
      : undefined;
  if (version === undefined) {
    return;
  }
  const otherVersion = version === 'tods' ? 'tods-v1' : 'tods';
  const existing = new Set(existingTableNames);
  const conflictingTables = compiledTables
    .filter(
      (table) =>
        table.specification === otherVersion && existing.has(table.tableName),
    )
    .map((table) => table.tableName);
  if (conflictingTables.length === 0) {
    return;
  }
  throw new GtfsError(
    `Database contains ${JSON.stringify(otherVersion)} tables; use a separate database for ${JSON.stringify(version)}`,
    {
      code: GtfsErrorCode.SCHEMA_INVALID,
      category: GtfsErrorCategory.DATABASE,
      details: {
        extension: version,
        conflictingExtension: otherVersion,
        conflictingTables,
      },
    },
  );
}
