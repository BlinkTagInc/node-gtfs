import pluralize from 'pluralize';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import mapSeries from 'promise-map-series';
import { get } from 'lodash-es';

import * as models from '../models/models.ts';
import { openDb } from './db.ts';
import { log, logError, logWarning } from './log-utils.ts';
import {
  convertLongTimeToDate,
  applyPrefixToValue,
  setDefaultConfig,
  validateConfigForImport,
} from './utils.ts';

import {
  Config,
  ConfigAgency,
  ModelColumn,
} from '../types/global_interfaces.ts';

interface GtfsRealtimeTask {
  realtimeAlerts?: {
    url: string;
    headers?: Record<string, string>;
  };
  realtimeTripUpdates?: {
    url: string;
    headers?: Record<string, string>;
  };
  realtimeVehiclePositions?: {
    url: string;
    headers?: Record<string, string>;
  };
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

async function fetchGtfsRealtimeData(
  urlConfig: { url: string; headers?: Record<string, string> },
  task: GtfsRealtimeTask,
) {
  task.log(`Downloading GTFS-Realtime from ${urlConfig.url}`);
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
    task.logWarning(
      `Unable to download GTFS-Realtime from ${urlConfig.url}. Got status ${response.status}.`,
    );
    return null;
  }

  const buffer = await response.arrayBuffer();
  const message = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer),
  );
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.toObject(message, {
    enums: String,
    longs: String,
    bytes: String,
    defaults: false,
    arrays: true,
    objects: true,
    oneofs: true,
  });
}

function removeExpiredRealtimeData(config: Config) {
  const db = openDb(config);

  log(config)(`Removing expired GTFS-Realtime data`);
  db.prepare(
    `DELETE FROM vehicle_positions WHERE expiration_timestamp <= strftime('%s','now')`,
  ).run();
  db.prepare(
    `DELETE FROM trip_updates WHERE expiration_timestamp <= strftime('%s','now')`,
  ).run();
  db.prepare(
    `DELETE FROM stop_time_updates WHERE expiration_timestamp <= strftime('%s','now')`,
  ).run();
  db.prepare(
    `DELETE FROM service_alerts WHERE expiration_timestamp <= strftime('%s','now')`,
  ).run();
  db.prepare(
    `DELETE FROM service_alert_informed_entities WHERE expiration_timestamp <= strftime('%s','now')`,
  ).run();
  log(config)(`Removed expired GTFS-Realtime data\r`, true);
}

function prepareRealtimeFieldValue(
  entity: any,
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

async function processRealtimeAlerts(
  db: any,
  gtfsRealtimeData: any,
  task: GtfsRealtimeTask,
) {
  const alertStmt = db.prepare(
    `REPLACE INTO ${models.serviceAlerts.filenameBase} (${models.serviceAlerts.schema
      .map((column) => column.name)
      .join(
        ', ',
      )}) VALUES (${models.serviceAlerts.schema.map(() => '?').join(', ')})`,
  );

  const informedEntityStmt = db.prepare(
    `REPLACE INTO ${models.serviceAlertInformedEntities.filenameBase} (${models.serviceAlertInformedEntities.schema
      .map((column) => column.name)
      .join(
        ', ',
      )}) VALUES (${models.serviceAlertInformedEntities.schema.map(() => '?').join(', ')})`,
  );

  let totalLineCount = 0;

  db.transaction(() => {
    for (const entity of gtfsRealtimeData.entity) {
      const fieldValues = (models.serviceAlerts.schema as ModelColumn[]).map(
        (column) => prepareRealtimeFieldValue(entity, column, task),
      );

      try {
        alertStmt.run(fieldValues);

        if (entity.alert.informedEntity?.length) {
          const informedEntities = entity.alert.informedEntity.map(
            (informedEntity: {
              directionId?: number;
              routeId?: string;
              routeType?: number;
              stopId?: string;
              trip?: {
                tripId?: string;
              };
              parent?: any;
            }) => {
              informedEntity.parent = entity;
              return (
                models.serviceAlertInformedEntities.schema as ModelColumn[]
              ).map((column) =>
                prepareRealtimeFieldValue(informedEntity, column, task),
              );
            },
          );

          for (const values of informedEntities) {
            informedEntityStmt.run(values);
          }
        }
        totalLineCount++;
      } catch (error: any) {
        task.logWarning(`Import error: ${error.message}`);
      }
    }

    task.log(
      `Importing - GTFS-Realtime service alerts - ${totalLineCount} entries imported\r`,
      true,
    );
  })();
}

async function processRealtimeTripUpdates(
  db: any,
  gtfsRealtimeData: any,
  task: GtfsRealtimeTask,
) {
  let totalLineCount = 0;

  const tripUpdateStmt = db.prepare(
    `REPLACE INTO ${models.tripUpdates.filenameBase} (${models.tripUpdates.schema
      .map((column) => column.name)
      .join(
        ', ',
      )}) VALUES (${models.tripUpdates.schema.map(() => '?').join(', ')})`,
  );

  const stopTimeStmt = db.prepare(
    `REPLACE INTO ${models.stopTimeUpdates.filenameBase} (${models.stopTimeUpdates.schema
      .map((column) => column.name)
      .join(
        ', ',
      )}) VALUES (${models.stopTimeUpdates.schema.map(() => '?').join(', ')})`,
  );

  db.transaction(() => {
    for (const entity of gtfsRealtimeData.entity) {
      try {
        const fieldValues = (models.tripUpdates.schema as ModelColumn[]).map(
          (column) => prepareRealtimeFieldValue(entity, column, task),
        );
        tripUpdateStmt.run(fieldValues);

        for (const stopTimeUpdate of entity.tripUpdate.stopTimeUpdate) {
          stopTimeUpdate.parent = entity;
          const values = (models.stopTimeUpdates.schema as ModelColumn[]).map(
            (column) => prepareRealtimeFieldValue(stopTimeUpdate, column, task),
          );
          stopTimeStmt.run(values);
        }

        totalLineCount++;
      } catch (error: any) {
        task.logWarning(`Import error: ${error.message}`);
      }
    }

    task.log(
      `Importing - GTFS-Realtime trip updates - ${totalLineCount} entries imported\r`,
      true,
    );
  })();
}

async function processRealtimeVehiclePositions(
  db: any,
  gtfsRealtimeData: any,
  task: GtfsRealtimeTask,
) {
  let totalLineCount = 0;

  const vehiclePositionStmt = db.prepare(
    `REPLACE INTO ${models.vehiclePositions.filenameBase} (${models.vehiclePositions.schema
      .map((column) => column.name)
      .join(
        ', ',
      )}) VALUES (${models.vehiclePositions.schema.map(() => '?').join(', ')})`,
  );

  db.transaction(() => {
    for (const entity of gtfsRealtimeData.entity) {
      try {
        const fieldValues = (
          models.vehiclePositions.schema as ModelColumn[]
        ).map((column) => prepareRealtimeFieldValue(entity, column, task));

        vehiclePositionStmt.run(fieldValues);

        totalLineCount++;
      } catch (error: any) {
        task.logWarning(`Import error: ${error.message}`);
      }
    }

    task.log(
      `Importing - GTFS-Realtime vehicle positions - ${totalLineCount} entries imported\r`,
      true,
    );
  })();
}

export async function updateGtfsRealtimeData(task: GtfsRealtimeTask) {
  if (
    task.realtimeAlerts === undefined &&
    task.realtimeTripUpdates === undefined &&
    task.realtimeVehiclePositions === undefined
  ) {
    return;
  }

  const db = openDb({ sqlitePath: task.sqlitePath });

  if (task.realtimeAlerts?.url) {
    try {
      const alertsData = await fetchGtfsRealtimeData(task.realtimeAlerts, task);
      if (alertsData?.entity) {
        await processRealtimeAlerts(db, alertsData, task);
      }
    } catch (error: any) {
      if (task.ignoreErrors) {
        task.logError(error.message);
      } else {
        throw error;
      }
    }
  }

  if (task.realtimeTripUpdates?.url) {
    try {
      const tripUpdatesData = await fetchGtfsRealtimeData(
        task.realtimeTripUpdates,
        task,
      );
      if (tripUpdatesData?.entity) {
        await processRealtimeTripUpdates(db, tripUpdatesData, task);
      }
    } catch (error: any) {
      if (task.ignoreErrors) {
        task.logError(error.message);
      } else {
        throw error;
      }
    }
  }

  if (task.realtimeVehiclePositions?.url) {
    try {
      const vehiclePositionsData = await fetchGtfsRealtimeData(
        task.realtimeVehiclePositions,
        task,
      );
      if (vehiclePositionsData?.entity) {
        await processRealtimeVehiclePositions(db, vehiclePositionsData, task);
      }
    } catch (error: any) {
      if (task.ignoreErrors) {
        task.logError(error.message);
      } else {
        throw error;
      }
    }
  }

  task.log(`GTFS-Realtime data import complete`);
}

export async function updateGtfsRealtime(initialConfig: Config) {
  const config = setDefaultConfig(initialConfig);
  validateConfigForImport(config);

  try {
    openDb(config);

    const agencyCount = config.agencies.length;
    log(config)(
      `Starting GTFS-Realtime refresh for ${pluralize(
        'agencies',
        agencyCount,
        true,
      )} using SQLite database at ${config.sqlitePath}`,
    );

    removeExpiredRealtimeData(config);

    await mapSeries(config.agencies, async (agency: ConfigAgency) => {
      try {
        const task = {
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
      } catch (error: any) {
        if (config.ignoreErrors) {
          logError(config)(error.message);
        } else {
          throw error;
        }
      }
    });

    log(config)(
      `Completed GTFS-Realtime refresh for ${pluralize(
        'agencies',
        agencyCount,
        true,
      )}\n`,
    );
  } catch (error: any) {
    if (error?.code === 'SQLITE_CANTOPEN') {
      logError(config)(
        `Unable to open sqlite database "${config.sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`,
      );
    }
    throw error;
  }
}
