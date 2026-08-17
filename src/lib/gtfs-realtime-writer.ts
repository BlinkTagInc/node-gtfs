import type { CompiledGtfsTable } from '../schema/compile-table.ts';

export type NormalizedRealtimeValue =
  string | number | bigint | Uint8Array | null;

export type NormalizedRealtimeRow = Readonly<
  Record<string, NormalizedRealtimeValue>
>;

export interface RealtimeDeletePredicate {
  field: string;
  value: NormalizedRealtimeValue;
  nullSafe?: boolean;
}

export type RealtimeMutation =
  | {
      operation: 'delete';
      table: CompiledGtfsTable;
      where: readonly RealtimeDeletePredicate[];
    }
  | {
      operation: 'replace';
      table: CompiledGtfsTable;
      row: NormalizedRealtimeRow;
    };

export interface NormalizedRealtimeEntity {
  mutations: readonly RealtimeMutation[];
}

export interface RealtimeWriteResult {
  recordCount: number;
  errors: unknown[];
}

export interface GtfsRealtimeWriter {
  writeEntities(
    entities: readonly NormalizedRealtimeEntity[],
  ): RealtimeWriteResult | Promise<RealtimeWriteResult>;
}
