import {
  readOperationSignal,
  throwIfOperationAborted,
  withOperationCancellation,
} from './cancellation.ts';
import { existsSync } from 'node:fs';

import type { GtfsDatabase } from './schema/database.ts';
import type {
  GtfsExportOptions,
  GtfsImportOptions,
  GtfsRealtimeRefreshOptions,
} from './types/config.ts';
import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from './diagnostics/errors.ts';
import type { GtfsImportResult } from './schedule/import/result.ts';
import type { GtfsExportResult } from './types/export.ts';
import { expandHomeDirectory } from './io/paths.ts';
import { Gtfs } from './instance.ts';
import { importGtfsOnConnection } from './schedule/import/import.ts';
import {
  initializeGtfsConnection,
  closeOwnedGtfsConnection,
} from './database/connection.ts';
import { withDatabaseCleanup } from './database/cleanup.ts';
import {
  resolveGtfsImportConfig,
  resolveGtfsExportConfig,
  type ResolvedGtfsImportConfig,
} from './config/resolver.ts';

async function importWithAutoDetectedExtensions<DB>(
  resolved: ResolvedGtfsImportConfig<DB>,
): Promise<GtfsImportResult> {
  const connection = initializeGtfsConnection(resolved.database);
  return withDatabaseCleanup(
    () =>
      importGtfsOnConnection(
        resolved,
        connection.sqlite === null
          ? { database: connection.database }
          : { sqlite: connection.sqlite },
      ),
    () => closeOwnedGtfsConnection(connection),
  );
}

/** Requires an explicit SQLite path or caller-owned client, which is left open. */
export async function importGtfs<DB = GtfsDatabase>(
  options: GtfsImportOptions<DB>,
): Promise<GtfsImportResult> {
  const signal = readOperationSignal(options);
  if (signal !== undefined) {
    throwIfOperationAborted(signal);
  }
  const { signal: _signal, ...config } = options;
  const resolved = resolveGtfsImportConfig<DB>(config);
  // Auto-detection must inspect every source before an immutable instance
  // extension set can exist, so it runs directly on an owned or borrowed connection.
  if (resolved.extensions === 'auto') {
    return withOperationCancellation(signal, resolved.reporting, () =>
      importWithAutoDetectedExtensions(resolved),
    );
  }

  const gtfs = new Gtfs({ ...config, extensions: resolved.extensions });
  return withDatabaseCleanup(
    () => gtfs.import(signal === undefined ? {} : { signal }),
    () => gtfs.close(),
  );
}

/** Exports Schedule data through one operation-owned GTFS instance. */
export async function exportGtfs<DB = GtfsDatabase>(
  options: GtfsExportOptions<DB>,
): Promise<GtfsExportResult> {
  const signal = readOperationSignal(options);
  if (signal !== undefined) {
    throwIfOperationAborted(signal);
  }
  const { signal: _signal, ...config } = options;
  const { database } = resolveGtfsExportConfig(config);
  if (
    database.dialect === 'sqlite' &&
    'path' in database &&
    database.path !== undefined &&
    database.path !== ':memory:' &&
    !existsSync(expandHomeDirectory(database.path))
  ) {
    throw new GtfsError(
      `SQLite database ${JSON.stringify(database.path)} does not exist; import data before exporting`,
      {
        code: GtfsErrorCode.DATABASE_NOT_FOUND,
        category: GtfsErrorCategory.DATABASE,
        details: {
          path: database.path,
          operation: 'export',
        },
      },
    );
  }
  const gtfs = new Gtfs(config);
  return withDatabaseCleanup(
    () => gtfs.export(signal === undefined ? {} : { signal }),
    () => gtfs.close(),
  );
}

/** Refreshes Realtime feeds through one operation-owned GTFS instance. */
export async function refreshGtfsRealtime<DB = GtfsDatabase>(
  options: GtfsRealtimeRefreshOptions<DB>,
): Promise<GtfsImportResult> {
  const signal = readOperationSignal(options);
  if (signal !== undefined) {
    throwIfOperationAborted(signal);
  }
  const { signal: _signal, ...config } = options;
  const gtfs = new Gtfs(config);
  return withDatabaseCleanup(
    () => gtfs.realtime.refresh(signal === undefined ? {} : { signal }),
    () => gtfs.close(),
  );
}
