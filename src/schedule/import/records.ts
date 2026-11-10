import type { CompiledGtfsTable } from '../../schema/compile-table.ts';
import type { NormalizedImportRow } from '../../values/normalize-row.ts';
import type { GtfsSourcePosition } from '../../diagnostics/position.ts';

export interface NormalizedImportRecord {
  readonly row: NormalizedImportRow;
  readonly position: GtfsSourcePosition;
}

export interface NormalizedImportRowBatch {
  readonly table: CompiledGtfsTable;
  readonly records: readonly NormalizedImportRecord[];
  readonly totalRecordCount: number;
}
