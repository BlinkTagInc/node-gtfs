import type { Config, Model } from '../types/global_interfaces.ts';
import type { ImportReport } from './errors.ts';
import type { NormalizedGtfsRow } from './gtfs-record-parser.ts';

export interface GtfsFileWriterOptions {
  model: Model;
  filename: string;
  ignoreDuplicates: boolean;
  prefix?: string;
  config: Config;
  report?: ImportReport;
}

export interface GtfsFileWriter {
  writeBatch(rows: NormalizedGtfsRow[]): void | Promise<void>;
}
