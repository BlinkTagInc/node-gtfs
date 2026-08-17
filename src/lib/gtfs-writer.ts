import type { CompiledGtfsTable } from '../schema/compile-table.ts';
import type { ReportingOptions } from '../reporting/types.ts';
import type { ImportReport } from './errors.ts';
import type { NormalizedGtfsRowBatch } from './gtfs-record-parser.ts';

export interface GtfsFileWriterOptions {
  table: CompiledGtfsTable;
  filename: string;
  ignoreDuplicates: boolean;
  prefix?: string;
  config: ReportingOptions;
  report?: ImportReport;
}

export interface GtfsFileWriter {
  writeBatch(batch: NormalizedGtfsRowBatch): void | Promise<void>;
}
