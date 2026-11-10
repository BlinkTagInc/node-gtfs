import { isPlainObject, isNonNegativeNumber } from '../config/options.ts';
import { assertReportingConfig } from '../reporting/options.ts';
import { createGtfsConfigError } from '../diagnostics/errors.ts';
import { isKyselyDatabase } from '../database/clients.ts';
import {
  assertGtfsExtensionEnabled,
  resolveGtfsExtensions,
} from '../schema/extensions.ts';
import type {
  GtfsRealtimeCleanupOptions,
  ResolvedGtfsRealtimeCleanupOptions,
} from './cleanup-types.ts';

export function resolveGtfsRealtimeCleanupOptions<DB>(
  options: GtfsRealtimeCleanupOptions<DB>,
): ResolvedGtfsRealtimeCleanupOptions {
  if (!isPlainObject(options)) {
    throw createGtfsConfigError(
      '`cleanupGtfsRealtime()` accepts one named options object',
    );
  }

  const candidate = options as unknown as Record<string, unknown>;
  const allowedOptions = [
    'database',
    'extensions',
    'reporting',
    'nowUnixSeconds',
    'sourceIds',
    'currentState',
    'snapshotHistory',
  ] as const;
  const unknownOption = Object.keys(candidate).find(
    (key) => !allowedOptions.includes(key as (typeof allowedOptions)[number]),
  );
  if (unknownOption !== undefined) {
    throw createGtfsConfigError(
      `Unknown \`cleanupGtfsRealtime()\` option ${JSON.stringify(unknownOption)}`,
    );
  }

  if (!isKyselyDatabase(options.database)) {
    throw createGtfsConfigError(
      'The `cleanupGtfsRealtime()` option `database` must be a Kysely instance',
      {
        method: 'cleanupGtfsRealtime()',
        path: 'database',
      },
    );
  }

  const reporting = options.reporting === undefined ? {} : options.reporting;
  assertReportingConfig(reporting);
  if (
    options.nowUnixSeconds !== undefined &&
    !isNonNegativeNumber(options.nowUnixSeconds, { integer: true })
  ) {
    throw createGtfsConfigError(
      'The `cleanupGtfsRealtime()` option `nowUnixSeconds` must be a non-negative safe Unix timestamp in seconds',
    );
  }
  if (
    options.sourceIds !== undefined &&
    (!Array.isArray(options.sourceIds) ||
      options.sourceIds.some(
        (sourceId) =>
          typeof sourceId !== 'string' || sourceId.trim().length === 0,
      ))
  ) {
    throw createGtfsConfigError(
      'The `cleanupGtfsRealtime()` option `sourceIds` must be an array of non-empty strings',
    );
  }
  if (
    options.currentState !== undefined &&
    typeof options.currentState !== 'boolean'
  ) {
    throw createGtfsConfigError(
      'The `cleanupGtfsRealtime()` option `currentState` must be a boolean',
    );
  }
  if (
    options.snapshotHistory !== undefined &&
    typeof options.snapshotHistory !== 'boolean'
  ) {
    throw createGtfsConfigError(
      'The `cleanupGtfsRealtime()` option `snapshotHistory` must be a boolean',
    );
  }

  assertGtfsExtensionEnabled(
    'realtime_snapshots',
    'gtfs-realtime',
    resolveGtfsExtensions(options.extensions),
  );

  return Object.freeze({
    reporting,
    nowUnixSeconds: options.nowUnixSeconds ?? Math.floor(Date.now() / 1000),
    ...(options.sourceIds === undefined
      ? {}
      : { sourceIds: Object.freeze([...options.sourceIds]) }),
    currentState: options.currentState ?? true,
    snapshotHistory: options.snapshotHistory ?? true,
  });
}
