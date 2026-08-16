import type { Config } from '../types/global_interfaces.ts';
import type { CompiledGtfsTable } from '../schema/compile-table.ts';
import type { ImportReport } from './errors.ts';
import type { NormalizedGtfsRow } from './gtfs-record-parser.ts';

export interface GtfsFileWriterOptions {
  table: CompiledGtfsTable;
  filename: string;
  ignoreDuplicates: boolean;
  prefix?: string;
  config: Config;
  report?: ImportReport;
}

export interface GtfsFileWriter {
  writeBatch(rows: NormalizedGtfsRow[]): void | Promise<void>;
}
