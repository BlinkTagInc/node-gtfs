import type { FileBackedCompiledGtfsTable } from '../schema/table-registry.ts';
import type { GtfsValidationNotice } from '../diagnostics/errors.ts';
import type {
  GtfsCsvParseOptions,
  GtfsValidationMode,
} from '../types/config.ts';
import type { GtfsSourcePosition } from '../diagnostics/position.ts';
import type { GtfsValidationSummary } from './summary.ts';

export type { GtfsValidationMode } from '../types/config.ts';
type GtfsUnknownFieldsMode = 'reject' | 'preserve' | 'discard';

export type GtfsSourceScanProgress =
  | {
      readonly stage: 'file';
      readonly phase: 'start' | 'progress' | 'complete';
      readonly filename: string;
      readonly rows: number;
    }
  | {
      readonly stage: 'references';
      readonly phase: 'start' | 'complete';
    };

export interface ValidateGtfsSourceOptions {
  readonly directory: string;
  readonly tables: readonly FileBackedCompiledGtfsTable[];
  readonly csv?: GtfsCsvParseOptions;
  readonly excludeFiles?: readonly string[];
  readonly mode: GtfsValidationMode;
  readonly onUnknownField: GtfsUnknownFieldsMode;
  readonly onDuplicateKey?: 'reject' | 'keep-first';
  readonly sourceId?: string;
  readonly onProgress?: (event: GtfsSourceScanProgress) => void;
  readonly onNotice?: (notice: GtfsValidationNotice) => void;
}

export interface GtfsSourceValidationResult extends GtfsValidationSummary {
  readonly valid: boolean;
  readonly shouldReject: boolean;
}

export interface ParsedGtfsSourceFile {
  readonly headers: readonly string[];
  readonly records: Iterable<GtfsValidationSourceRecord>;
}

export interface GtfsValidationSourceRecord {
  readonly row: Readonly<Record<string, string>>;
  readonly position: Exclude<GtfsSourcePosition, { kind: 'realtime' }>;
}
