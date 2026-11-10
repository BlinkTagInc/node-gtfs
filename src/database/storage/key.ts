import { createHash } from 'node:crypto';

import { getStorageKeyColumnNames } from '../../schema/compile-table.ts';
import type { CompiledGtfsTable } from '../../schema/compile-table.ts';
import type { NormalizedGtfsValue } from '../../values/normalize-row.ts';

type CanonicalKeyPart =
  readonly [0] | readonly [1, string] | readonly [2, string];

/**
 * Encodes storage-key values without sentinel values that can collide with
 * source data. The tuple tag distinguishes null, text, and numeric values;
 * JSON string escaping and array boundaries make the encoding unambiguous.
 */
export function encodeGtfsCanonicalKey(
  values: readonly NormalizedGtfsValue[],
): string {
  const parts: CanonicalKeyPart[] = values.map((value) => {
    if (value === null) {
      return [0];
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new TypeError(
          'Canonical GTFS keys require finite numeric values',
        );
      }
      return [2, String(value)];
    }
    return [1, value];
  });
  return JSON.stringify(parts);
}

/** Returns the fixed-width canonical digest stored and uniquely indexed. */
export function digestGtfsCanonicalKey(
  values: readonly NormalizedGtfsValue[],
): string {
  return createHash('sha256')
    .update(encodeGtfsCanonicalKey(values))
    .digest('hex');
}

/** Builds a table's canonical digest in manifest storage-key order. */
export function getGtfsCanonicalKeyDigest(
  table: CompiledGtfsTable,
  row: Readonly<Record<string, unknown>>,
): string | undefined {
  if (table.keyStrategy !== 'canonical') {
    return undefined;
  }
  return digestGtfsCanonicalKey(
    getStorageKeyColumnNames(table).map((column) => {
      const value = row[column];
      if (value === undefined || value === null) {
        return null;
      }
      if (
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'bigint'
      ) {
        throw new TypeError(
          `Canonical GTFS key field ${column} must contain a scalar value`,
        );
      }
      return value;
    }),
  );
}
