import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { openDb } from './db.ts';
import { log, report, status } from '../reporting/report.ts';
import {
  formatCount,
  formatFileCount,
  formatUrl,
  pluralize,
} from '../reporting/format.ts';
import { validateConfig } from './validate-config.ts';
import { applyConfigDefaults, escapeIdentifier, mapSeries } from './utils.ts';
import {
  addImportError,
  formatGtfsError,
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
  ImportReport,
  toGtfsError,
} from './errors.ts';

import type {
  GtfsRealtimeConfig,
  GtfsRealtimeEndpoint,
  GtfsRealtimeFeedConfig,
} from '../types/config.ts';
import type { ReportingOptions } from '../reporting/types.ts';
import {
  normalizeRealtimeEntity,
  type RawRealtimeEntity,
  type RealtimeFeedKind,
} from './gtfs-realtime-normalizer.ts';
import type { GtfsRealtimeWriter } from './gtfs-realtime-writer.ts';
import { createSqliteGtfsRealtimeWriter } from './sqlite-gtfs-realtime-writer.ts';

interface GtfsRealtimeTask {
  realtimeAlerts?: GtfsRealtimeEndpoint;
  realtimeTripUpdates?: GtfsRealtimeEndpoint;
  realtimeVehiclePositions?: GtfsRealtimeEndpoint;
  downloadTimeout?: number;
  gtfsRealtimeExpirationSeconds: number;
  ignoreErrors: boolean;
  sqlitePath: string;
  prefix?: string;
  currentTimestamp: number;
  config: ReportingOptions;
  report?: ImportReport;
}

interface RealtimeData {
  entity: RawRealtimeEntity[];
}

interface ProcessingResult {
  recordCount: number;
  errorCount: number;
}

interface BatchProcessor<T> {
  (batch: T[]): Promise<ProcessingResult>;
}

const BATCH_SIZE = 1000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * Processes entities in batches
 */
async function processBatch<T>(
  items: T[],
  batchSize: number,
  processor: BatchProcessor<T>,
  config: ReportingOptions,
): Promise<ProcessingResult> {
  let totalRecordCount = 0;
  let totalErrorCount = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    try {
      const result = await processor(batch);
      totalRecordCount += result.recordCount;
      totalErrorCount += result.errorCount;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      totalErrorCount += batch.length;
      log(config, 'error', `Batch processing error: ${errorMessage}`);
    }
  }

  return { recordCount: totalRecordCount, errorCount: totalErrorCount };
}

type RealtimeType = RealtimeFeedKind;

type RealtimeRecordCounts = Record<RealtimeType, number>;

const RECORD_AGENCY_KEY: Record<RealtimeType, keyof GtfsRealtimeFeedConfig> = {
  alerts: 'realtimeAlerts',
  tripupdates: 'realtimeTripUpdates',
  vehiclepositions: 'realtimeVehiclePositions',
};

const RECORD_LABEL: Record<RealtimeType, string> = {
  alerts: 'alerts',
  tripupdates: 'trip updates',
  vehiclepositions: 'vehicle positions',
};

/**
 * Fetches GTFS Realtime data
 */
async function fetchGtfsRealtimeData(
  type: RealtimeType,
  task: GtfsRealtimeTask,
): Promise<RealtimeData | null> {
  const urlConfig = getUrlConfig(type, task);

  if (!urlConfig) {
    return null;
  }

  status(
    task.config,
    `Importing GTFS-Realtime from ${formatUrl(urlConfig.url)}`,
  );

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(urlConfig.url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'node-gtfs',
          ...urlConfig.headers,
          'Accept-Encoding': 'gzip',
        },
        signal: task.downloadTimeout
          ? AbortSignal.timeout(task.downloadTimeout)
          : undefined,
      });

      if (!response.ok) {
        await response.body?.cancel();
        throw new GtfsError(`HTTP ${response.status}: ${response.statusText}`, {
          code: GtfsErrorCode.GTFS_DOWNLOAD_HTTP,
          category: GtfsErrorCategory.DOWNLOAD,
          statusCode: response.status,
          details: {
            url: urlConfig.url,
            status: response.status,
            statusText: response.statusText,
          },
        });
      }

      const buffer = await response.arrayBuffer();
      const message = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(buffer),
      );

      const feedMessage =
        GtfsRealtimeBindings.transit_realtime.FeedMessage.toObject(message, {
          enums: String,
          longs: String,
          bytes: String,
          defaults: false,
          arrays: true,
          objects: true,
          oneofs: true,
        }) as RealtimeData;

      return feedMessage;
    } catch (error: unknown) {
      const gtfsError = toGtfsError(error, {
        message: error instanceof Error ? error.message : String(error),
        code: GtfsErrorCode.GTFS_DOWNLOAD_FAILED,
        category: GtfsErrorCategory.DOWNLOAD,
        details: { type, url: urlConfig.url },
      });
      if (attempt === MAX_RETRIES) {
        if (task.ignoreErrors) {
          log(
            task.config,
            'error',
            `Failed to fetch ${type} after ${MAX_RETRIES} attempts: ${gtfsError.message}`,
          );
          if (task.report) {
            addImportError(task.report, gtfsError);
          }
          return null;
        }
        throw gtfsError;
      }

      log(
        task.config,
        'warning',
        `Attempt ${attempt} of ${MAX_RETRIES} for ${type} did not succeed, retrying: ${gtfsError.message}`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY * attempt),
      );
    }
  }

  return null;
}

/**
 * Gets URL configuration for a specific realtime type
 */
function getUrlConfig(
  type: RealtimeType,
  task: GtfsRealtimeTask,
): GtfsRealtimeEndpoint | undefined {
  switch (type) {
    case 'alerts':
      return task.realtimeAlerts;
    case 'tripupdates':
      return task.realtimeTripUpdates;
    case 'vehiclepositions':
      return task.realtimeVehiclePositions;
    default:
      return undefined;
  }
}

function createRealtimeProcessor(
  writer: GtfsRealtimeWriter,
  kind: RealtimeType,
  task: GtfsRealtimeTask,
): BatchProcessor<RawRealtimeEntity> {
  const entityLabel: Record<RealtimeType, string> = {
    alerts: 'an alert',
    tripupdates: 'a trip update',
    vehiclepositions: 'a vehicle position',
  };

  return async (batch): Promise<ProcessingResult> => {
    const normalizedEntities = [];
    let errorCount = 0;

    for (const entity of batch) {
      try {
        normalizedEntities.push(
          normalizeRealtimeEntity(kind, entity, {
            currentTimestamp: task.currentTimestamp,
            expirationSeconds: task.gtfsRealtimeExpirationSeconds,
            prefix: task.prefix,
          }),
        );
      } catch (error: unknown) {
        errorCount += 1;
        const message = error instanceof Error ? error.message : String(error);
        log(
          task.config,
          'warning',
          `Skipping ${entityLabel[kind]} that could not be normalized: ${message}`,
        );
      }
    }

    const result = await writer.writeEntities(normalizedEntities);
    for (const error of result.errors) {
      const message = error instanceof Error ? error.message : String(error);
      log(
        task.config,
        'warning',
        `Skipping ${entityLabel[kind]} that could not be written: ${message}`,
      );
    }

    return {
      recordCount: result.recordCount,
      errorCount: errorCount + result.errors.length,
    };
  };
}

/**
 * Removes expired GTFS-Realtime data
 */
function removeExpiredRealtimeData(config: GtfsRealtimeConfig): void {
  const db = openDb(config);

  let removed = 0;

  db.transaction(() => {
    const tables = [
      'vehicle_positions',
      'trip_updates',
      'stop_time_updates',
      'service_alerts',
      'service_alert_informed_entities',
    ];

    for (const table of tables) {
      removed += db
        .prepare(
          `DELETE FROM ${escapeIdentifier(table)} WHERE ${escapeIdentifier('expiration_timestamp')} <= strftime('%s','now')`,
        )
        .run().changes;
    }
  })();

  if (removed > 0) {
    status(
      config,
      `Removed ${pluralize('expired record', 'expired records', removed)}`,
    );
  }
}

/**
 * Updates GTFS Realtime data
 */
export async function updateGtfsRealtimeData(
  task: GtfsRealtimeTask,
): Promise<RealtimeRecordCounts> {
  const recordCounts: RealtimeRecordCounts = {
    alerts: 0,
    tripupdates: 0,
    vehiclepositions: 0,
  };

  if (
    !task.realtimeAlerts &&
    !task.realtimeTripUpdates &&
    !task.realtimeVehiclePositions
  ) {
    return recordCounts;
  }

  // Download all data types in parallel
  const [alertsData, tripUpdatesData, vehiclePositionsData] = await Promise.all(
    [
      task.realtimeAlerts?.url ? fetchGtfsRealtimeData('alerts', task) : null,
      task.realtimeTripUpdates?.url
        ? fetchGtfsRealtimeData('tripupdates', task)
        : null,
      task.realtimeVehiclePositions?.url
        ? fetchGtfsRealtimeData('vehiclepositions', task)
        : null,
    ],
  );

  const db = openDb({ sqlitePath: task.sqlitePath });
  const writer = createSqliteGtfsRealtimeWriter(db);

  // Shared SQLite transactions must not overlap.
  if (alertsData?.entity?.length) {
    const result = await processBatch(
      alertsData.entity,
      BATCH_SIZE,
      createRealtimeProcessor(writer, 'alerts', task),
      task.config,
    );
    recordCounts.alerts = result.recordCount;
  }

  if (tripUpdatesData?.entity?.length) {
    const result = await processBatch(
      tripUpdatesData.entity,
      BATCH_SIZE,
      createRealtimeProcessor(writer, 'tripupdates', task),
      task.config,
    );
    recordCounts.tripupdates = result.recordCount;
  }

  if (vehiclePositionsData?.entity?.length) {
    const result = await processBatch(
      vehiclePositionsData.entity,
      BATCH_SIZE,
      createRealtimeProcessor(writer, 'vehiclepositions', task),
      task.config,
    );
    recordCounts.vehiclepositions = result.recordCount;
  }

  status(task.config, 'Imported');

  for (const [type, label] of Object.entries(RECORD_LABEL)) {
    if (getUrlConfig(type as RealtimeType, task)) {
      status(
        task.config,
        formatFileCount(label, recordCounts[type as RealtimeType]),
      );
    }
  }

  return recordCounts;
}

/**
 * Main function to update GTFS Realtime data
 */
export async function updateGtfsRealtime(
  initialConfig: GtfsRealtimeConfig,
): Promise<void> {
  validateConfig(
    initialConfig,
    (message) => log(initialConfig, 'warning', message),
    { requireStaticSource: false },
  );

  const config = applyConfigDefaults(initialConfig, {
    sqlitePath: ':memory:',
    ignoreErrors: false,
    gtfsRealtimeExpirationSeconds: 0,
    downloadTimeout: 30000,
  });
  const startTime = process.hrtime.bigint();

  try {
    openDb(config);

    const agencyCount = config.agencies.length;
    report(config, {
      type: 'run:start',
      task: 'realtime',
      agencyCount,
      sqlitePath: config.sqlitePath ?? ':memory:',
    });

    removeExpiredRealtimeData(config);

    const totals: RealtimeRecordCounts = {
      alerts: 0,
      tripupdates: 0,
      vehiclepositions: 0,
    };

    await mapSeries(config.agencies, async (agency: GtfsRealtimeFeedConfig) => {
      let task: GtfsRealtimeTask | undefined;
      try {
        task = {
          realtimeAlerts: agency.realtimeAlerts,
          realtimeTripUpdates: agency.realtimeTripUpdates,
          realtimeVehiclePositions: agency.realtimeVehiclePositions,
          downloadTimeout: config.downloadTimeout,
          gtfsRealtimeExpirationSeconds: config.gtfsRealtimeExpirationSeconds,
          ignoreErrors: config.ignoreErrors,
          sqlitePath: config.sqlitePath,
          prefix: agency.prefix,
          currentTimestamp: Math.floor(Date.now() / 1000),
          config,
        };

        const recordCounts = await updateGtfsRealtimeData(task);

        for (const type of Object.keys(RECORD_LABEL) as RealtimeType[]) {
          totals[type] += recordCounts[type];
        }
      } catch (error: unknown) {
        const gtfsError = toGtfsError(error, {
          message: error instanceof Error ? error.message : String(error),
          code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
          category: GtfsErrorCategory.DATABASE,
          details: { sqlitePath: task?.sqlitePath ?? config.sqlitePath },
        });
        if (config.ignoreErrors) {
          log(config, 'error', formatGtfsError(gtfsError));
          if (task?.report) {
            addImportError(task.report, gtfsError);
          }
        } else {
          throw gtfsError;
        }
      }
    });

    report(config, {
      type: 'run:complete',
      task: 'realtime',
      elapsedSeconds:
        Number(process.hrtime.bigint() - startTime) / 1_000_000_000,
      summary: (Object.keys(RECORD_LABEL) as RealtimeType[])
        .filter((type) =>
          config.agencies.some((agency) => agency[RECORD_AGENCY_KEY[type]]),
        )
        .map((type) => `${formatCount(totals[type])} ${RECORD_LABEL[type]}`)
        .join(', '),
    });
  } catch (error: unknown) {
    if ((error as Error & { code?: string }).code === 'SQLITE_CANTOPEN') {
      const dbOpenError = new GtfsError(
        `Unable to open sqlite database "${config.sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`,
        {
          code: GtfsErrorCode.DB_OPEN_FAILED,
          category: GtfsErrorCategory.DATABASE,
          details: {
            sqlitePath: config.sqlitePath,
            dbCode: (error as Error & { code?: string }).code,
          },
          cause: error,
        },
      );
      log(config, 'error', dbOpenError.message);
      throw dbOpenError;
    }
    throw toGtfsError(error, {
      message: error instanceof Error ? error.message : String(error),
      code: GtfsErrorCode.GTFS_DB_OPERATION_FAILED,
      category: GtfsErrorCategory.DATABASE,
    });
  }
}
