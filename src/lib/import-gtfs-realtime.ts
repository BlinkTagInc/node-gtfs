import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import mapSeries from 'promise-map-series';
import { get } from 'lodash-es';
import Database from 'better-sqlite3';

import * as models from '../models/models.ts';
import { openDb } from './db.ts';
import { log, logError, logWarning } from './log-utils.ts';
import {
  convertLongTimeToDate,
  applyPrefixToValue,
  pluralize,
  setDefaultConfig,
  validateConfigForImport,
} from './utils.ts';

import {
  Config,
  ConfigAgency,
  ModelColumn,
  Model,
} from '../types/global_interfaces.ts';

interface RealtimeUrlConfig {
  url: string;
  headers?: Record<string, string>;
}

interface GtfsRealtimeTask {
  realtimeAlerts?: RealtimeUrlConfig;
  realtimeTripUpdates?: RealtimeUrlConfig;
  realtimeVehiclePositions?: RealtimeUrlConfig;
  downloadTimeout?: number;
  gtfsRealtimeExpirationSeconds: number;
  ignoreErrors: boolean;
  sqlitePath: string;
  prefix?: string;
  currentTimestamp: number;
  log: (message: string, newLine?: boolean) => void;
  logWarning: (message: string) => void;
  logError: (message: string) => void;
}

interface ProcessedEntity {
  id: string;
  alert?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  tripUpdate?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  vehicle?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface RealtimeData {
  entity: ProcessedEntity[];
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
 * Prepares a field value for database insertion
 */
function prepareRealtimeFieldValue(
  entity: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  column: ModelColumn,
  task: GtfsRealtimeTask,
) {
  if (column.name === 'created_timestamp') {
    return task.currentTimestamp;
  }

  if (column.name === 'expiration_timestamp') {
    return task.currentTimestamp + task.gtfsRealtimeExpirationSeconds;
  }

  const baseValue =
    column.source === undefined
      ? column.default
      : get(entity, column.source, column.default);

  const timeAdjustedValue = baseValue?.__isLong__
    ? convertLongTimeToDate(baseValue)
    : baseValue;

  const prefixedValue = applyPrefixToValue(
    timeAdjustedValue,
    column.prefix,
    task.prefix,
  );

  return column.type === 'json' ? JSON.stringify(prefixedValue) : prefixedValue;
}

/**
 * Creates a prepared statement for a model
 */
function createPreparedStatement(db: Database.Database, model: Model) {
  const columns = model.schema.map((column: ModelColumn) => column.name);
  const placeholders = model.schema.map(() => '?').join(', ');

  return db.prepare(
    `REPLACE INTO ${model.filenameBase} (${columns.join(', ')}) VALUES (${placeholders})`,
  );
}

/**
 * Processes entities in batches
 */
async function processBatch<T>(
  items: T[],
  batchSize: number,
  processor: BatchProcessor<T>,
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
      console.error(`Batch processing error: ${errorMessage}`);
    }
  }

  return { recordCount: totalRecordCount, errorCount: totalErrorCount };
}

/**
 * Fetches GTFS Realtime data
 */
async function fetchGtfsRealtimeData(
  type: 'alerts' | 'tripupdates' | 'vehiclepositions',
  task: GtfsRealtimeTask,
): Promise<RealtimeData | null> {
  const urlConfig = getUrlConfig(type, task);

  if (!urlConfig) {
    return null;
  }

  task.log(`Importing - GTFS-Realtime from ${urlConfig.url}`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(urlConfig.url, {
        method: 'GET',
        headers: {
          ...(urlConfig.headers ?? {}),
          'Accept-Encoding': 'gzip',
        },
        signal: task.downloadTimeout
          ? AbortSignal.timeout(task.downloadTimeout)
          : undefined,
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (attempt === MAX_RETRIES) {
        if (task.ignoreErrors) {
          task.logError(
            `Failed to fetch ${type} after ${MAX_RETRIES} attempts: ${errorMessage}`,
          );
          return null;
        }
        throw error;
      }

      task.logWarning(`Attempt ${attempt} failed for ${type}: ${errorMessage}`);
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
  type: 'alerts' | 'tripupdates' | 'vehiclepositions',
  task: GtfsRealtimeTask,
): RealtimeUrlConfig | undefined {
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

/**
 * Creates a processor for service alerts
 */
function createServiceAlertsProcessor(
  db: Database.Database,
  task: GtfsRealtimeTask,
): BatchProcessor<ProcessedEntity> {
  const alertStmt = createPreparedStatement(db, models.serviceAlerts as Model);
  const informedEntityStmt = createPreparedStatement(
    db,
    models.serviceAlertInformedEntities as Model,
  );

  return async (batch: ProcessedEntity[]): Promise<ProcessingResult> => {
    let recordCount = 0;
    let errorCount = 0;

    db.transaction(() => {
      for (const entity of batch) {
        try {
          // Process main alert
          const alertValues = (
            models.serviceAlerts.schema as ModelColumn[]
          ).map((column) => prepareRealtimeFieldValue(entity, column, task));
          alertStmt.run(alertValues);
          recordCount++;

          // Process informed entities
          if (entity.alert?.informedEntity?.length) {
            for (const informedEntity of entity.alert.informedEntity) {
              informedEntity.parent = entity;
              const entityValues = (
                models.serviceAlertInformedEntities.schema as ModelColumn[]
              ).map((column) =>
                prepareRealtimeFieldValue(informedEntity, column, task),
              );
              informedEntityStmt.run(entityValues);
              recordCount++;
            }
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errorCount++;
          task.logWarning(`Alert processing error: ${errorMessage}`);
        }
      }
    })();

    return { recordCount, errorCount };
  };
}

/**
 * Creates a processor for trip updates
 */
function createTripUpdatesProcessor(
  db: Database.Database,
  task: GtfsRealtimeTask,
): BatchProcessor<ProcessedEntity> {
  const tripUpdateStmt = createPreparedStatement(
    db,
    models.tripUpdates as Model,
  );
  const stopTimeStmt = createPreparedStatement(
    db,
    models.stopTimeUpdates as Model,
  );

  return async (batch: ProcessedEntity[]): Promise<ProcessingResult> => {
    let recordCount = 0;
    let errorCount = 0;

    db.transaction(() => {
      for (const entity of batch) {
        try {
          // Process main trip update
          const tripUpdateValues = (
            models.tripUpdates.schema as ModelColumn[]
          ).map((column) => prepareRealtimeFieldValue(entity, column, task));
          tripUpdateStmt.run(tripUpdateValues);
          recordCount++;

          // Process stop time updates
          if (entity.tripUpdate?.stopTimeUpdate?.length) {
            for (const stopTimeUpdate of entity.tripUpdate.stopTimeUpdate) {
              stopTimeUpdate.parent = entity;
              const stopTimeValues = (
                models.stopTimeUpdates.schema as ModelColumn[]
              ).map((column) =>
                prepareRealtimeFieldValue(stopTimeUpdate, column, task),
              );
              stopTimeStmt.run(stopTimeValues);
              recordCount++;
            }
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errorCount++;
          task.logWarning(`Trip update processing error: ${errorMessage}`);
        }
      }
    })();

    return { recordCount, errorCount };
  };
}

/**
 * Creates a processor for vehicle positions
 */
function createVehiclePositionsProcessor(
  db: Database.Database,
  task: GtfsRealtimeTask,
): BatchProcessor<ProcessedEntity> {
  const vehiclePositionStmt = createPreparedStatement(
    db,
    models.vehiclePositions as Model,
  );

  return async (batch: ProcessedEntity[]): Promise<ProcessingResult> => {
    let recordCount = 0;
    let errorCount = 0;

    db.transaction(() => {
      for (const entity of batch) {
        try {
          const fieldValues = (
            models.vehiclePositions.schema as ModelColumn[]
          ).map((column) => prepareRealtimeFieldValue(entity, column, task));
          vehiclePositionStmt.run(fieldValues);
          recordCount++;
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errorCount++;
          task.logWarning(`Vehicle position processing error: ${errorMessage}`);
        }
      }
    })();

    return { recordCount, errorCount };
  };
}

/**
 * Removes expired GTFS-Realtime data
 */
function removeExpiredRealtimeData(config: Config): void {
  const db = openDb(config);

  log(config)(`Removing expired GTFS-Realtime data`);

  db.transaction(() => {
    const tables = [
      'vehicle_positions',
      'trip_updates',
      'stop_time_updates',
      'service_alerts',
      'service_alert_informed_entities',
    ];

    for (const table of tables) {
      db.prepare(
        `DELETE FROM ${table} WHERE expiration_timestamp <= strftime('%s','now')`,
      ).run();
    }
  })();

  log(config)(`Removed expired GTFS-Realtime data\r`, true);
}

/**
 * Updates GTFS Realtime data
 */
export async function updateGtfsRealtimeData(
  task: GtfsRealtimeTask,
): Promise<void> {
  if (
    !task.realtimeAlerts &&
    !task.realtimeTripUpdates &&
    !task.realtimeVehiclePositions
  ) {
    return;
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

  const recordCounts = {
    alerts: 0,
    tripupdates: 0,
    vehiclepositions: 0,
  };

  // Process each data type with batching
  const processingPromises: Promise<void>[] = [];

  if (alertsData?.entity?.length) {
    processingPromises.push(
      processBatch(
        alertsData.entity,
        BATCH_SIZE,
        createServiceAlertsProcessor(db, task),
      ).then((result) => {
        recordCounts.alerts = result.recordCount;
      }),
    );
  }

  if (tripUpdatesData?.entity?.length) {
    processingPromises.push(
      processBatch(
        tripUpdatesData.entity,
        BATCH_SIZE,
        createTripUpdatesProcessor(db, task),
      ).then((result) => {
        recordCounts.tripupdates = result.recordCount;
      }),
    );
  }

  if (vehiclePositionsData?.entity?.length) {
    processingPromises.push(
      processBatch(
        vehiclePositionsData.entity,
        BATCH_SIZE,
        createVehiclePositionsProcessor(db, task),
      ).then((result) => {
        recordCounts.vehiclepositions = result.recordCount;
      }),
    );
  }

  // Wait for all processing to complete
  await Promise.all(processingPromises);

  task.log(
    `GTFS-Realtime import complete: ${recordCounts.alerts} alerts, ${recordCounts.tripupdates} trip updates, ${recordCounts.vehiclepositions} vehicle positions`,
  );
}

/**
 * Main function to update GTFS Realtime data
 */
export async function updateGtfsRealtime(initialConfig: Config): Promise<void> {
  const config = setDefaultConfig(initialConfig);
  validateConfigForImport(config);

  try {
    openDb(config);

    const agencyCount = config.agencies.length;
    log(config)(
      `Starting GTFS-Realtime refresh for ${pluralize(
        'agency',
        'agencies',
        agencyCount,
      )} using SQLite database at ${config.sqlitePath}`,
    );

    removeExpiredRealtimeData(config);

    await mapSeries(config.agencies, async (agency: ConfigAgency) => {
      try {
        const task: GtfsRealtimeTask = {
          realtimeAlerts: agency.realtimeAlerts,
          realtimeTripUpdates: agency.realtimeTripUpdates,
          realtimeVehiclePositions: agency.realtimeVehiclePositions,
          downloadTimeout: config.downloadTimeout,
          gtfsRealtimeExpirationSeconds: config.gtfsRealtimeExpirationSeconds,
          ignoreErrors: config.ignoreErrors,
          sqlitePath: config.sqlitePath,
          prefix: agency.prefix,
          currentTimestamp: Math.floor(Date.now() / 1000),
          log: log(config),
          logWarning: logWarning(config),
          logError: logError(config),
        };

        await updateGtfsRealtimeData(task);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (config.ignoreErrors) {
          logError(config)(errorMessage);
        } else {
          throw error;
        }
      }
    });

    log(config)(
      `Completed GTFS-Realtime refresh for ${pluralize(
        'agency',
        'agencies',
        agencyCount,
      )}\n`,
    );
  } catch (error: unknown) {
    if ((error as Error & { code?: string }).code === 'SQLITE_CANTOPEN') {
      logError(config)(
        `Unable to open sqlite database "${config.sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`,
      );
    }
    throw error;
  }
}
