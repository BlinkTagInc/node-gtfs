import pluralize from 'pluralize';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import sqlString from 'sqlstring-sqlite';
import mapSeries from 'promise-map-series';

import * as models from '../models/models.ts';
import { openDb } from './db.ts';
import { log, logError, logWarning } from './log-utils.ts';
import {
  convertLongTimeToDate,
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
  currentTimestamp: number;
  log: (message: string, newLine?: boolean) => void;
  logWarning: (message: string) => void;
  logError: (message: string) => void;
}

function getNestedProperty(obj: any, defaultValue: any, path?: string) {
  if (path === undefined) return defaultValue;
  const arr = path.split('.');
  while (arr.length) {
    const nextKey = arr.shift();
    if (nextKey === undefined) {
      return defaultValue;
    } else if (obj == null) {
      return defaultValue;
    } else if (nextKey?.includes('[')) {
      const arrayKey = nextKey.match(/(\w*)\[(\d+)\]/);
      if (arrayKey === null) {
        return defaultValue;
      }
      if (obj[arrayKey[1]] === undefined) {
        return defaultValue;
      }

      if (obj[arrayKey[1]][arrayKey[2]] === undefined) {
        return defaultValue;
      }

      obj = obj[arrayKey[1]][arrayKey[2]];
    } else {
      if (obj[nextKey] === undefined) {
        return defaultValue;
      }
      obj = obj[nextKey];
    }
  }

  if (obj?.__isLong__) return convertLongTimeToDate(obj);

  return obj;
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

  const value = getNestedProperty(entity, column.default, column.source);

  if (column.type === 'json') {
    return sqlString.escape(JSON.stringify(value));
  }

  return sqlString.escape(value);
}

async function processRealtimeAlerts(
  db: any,
  gtfsRealtimeData: any,
  task: GtfsRealtimeTask,
) {
  task.log(`Download successful`);

  let totalLineCount = 0;

  for (const entity of gtfsRealtimeData.entity) {
    // Do base processing
    const fieldValues = (models.serviceAlerts.schema as ModelColumn[]).map(
      (column) => prepareRealtimeFieldValue(entity, column, task),
    );

    try {
      db.prepare(
        `REPLACE INTO ${models.serviceAlerts.filenameBase} (${models.serviceAlerts.schema
          .map((column) => column.name)
          .join(', ')}) VALUES (${fieldValues.join(', ')})`,
      ).run();
    } catch (error: any) {
      task.logWarning(`Import error: ${error.message}`);
    }

    if (
      !entity.alert.informedEntity ||
      entity.alert.informedEntity.length === 0
    ) {
      task.logWarning(
        `Import error: No informed entities found for alert id=${entity.id}`,
      );
    } else {
      const informedEntities = [];
      for (const informedEntity of entity.alert.informedEntity) {
        informedEntity.parent = entity;
        const subValues = (
          models.serviceAlertInformedEntities.schema as ModelColumn[]
        ).map((column) =>
          prepareRealtimeFieldValue(informedEntity, column, task),
        );
        informedEntities.push(`(${subValues.join(', ')})`);
        totalLineCount++;
      }

      try {
        db.prepare(
          `REPLACE INTO ${models.serviceAlertInformedEntities.filenameBase} (${models.serviceAlertInformedEntities.schema
            .map((column) => column.name)
            .join(', ')}) VALUES ${informedEntities.join(', ')}`,
        ).run();
      } catch (error: any) {
        task.logWarning(`Import error: ${error.message}`);
      }
    }

    task.log(`Importing - ${totalLineCount++} entries imported\r`, true);
  }
}

async function processRealtimeTripUpdates(
  db: any,
  gtfsRealtimeData: any,
  task: GtfsRealtimeTask,
) {
  task.log(`Download successful`);

  let totalLineCount = 0;

  for (const entity of gtfsRealtimeData.entity) {
    // Do base processing
    const fieldValues = (models.tripUpdates.schema as ModelColumn[]).map(
      (column) => prepareRealtimeFieldValue(entity, column, task),
    );

    try {
      db.prepare(
        `REPLACE INTO ${models.tripUpdates.filenameBase} (${models.tripUpdates.schema
          .map((column) => column.name)
          .join(', ')}) VALUES (${fieldValues.join(', ')})`,
      ).run();
    } catch (error: any) {
      task.logWarning(`Import error: ${error.message}`);
    }

    const stopTimeUpdateArray = [];
    for (const stopTimeUpdate of entity.tripUpdate.stopTimeUpdate) {
      stopTimeUpdate.parent = entity;
      const subValues = (models.stopTimeUpdates.schema as ModelColumn[]).map(
        (column) => prepareRealtimeFieldValue(stopTimeUpdate, column, task),
      );
      stopTimeUpdateArray.push(`(${subValues.join(', ')})`);
      totalLineCount++;
    }

    try {
      db.prepare(
        `REPLACE INTO ${models.stopTimeUpdates.filenameBase} (${models.stopTimeUpdates.schema
          .map((column) => column.name)
          .join(', ')}) VALUES ${stopTimeUpdateArray.join(', ')}`,
      ).run();
    } catch (error: any) {
      task.logWarning(`Import error: ${error.message}`);
    }

    task.log(`Importing - ${totalLineCount++} entries imported\r`, true);
  }
}

async function processRealtimeVehiclePositions(
  db: any,
  gtfsRealtimeData: any,
  task: GtfsRealtimeTask,
) {
  task.log(`Download successful`);

  let totalLineCount = 0;

  for (const entity of gtfsRealtimeData.entity) {
    // Do base processing
    const fieldValues = (models.vehiclePositions.schema as ModelColumn[]).map(
      (column) => prepareRealtimeFieldValue(entity, column, task),
    );

    try {
      db.prepare(
        `REPLACE INTO ${models.vehiclePositions.filenameBase} (${models.vehiclePositions.schema
          .map((column) => column.name)
          .join(', ')}) VALUES (${fieldValues.join(', ')})`,
      ).run();
    } catch (error: any) {
      task.logWarning(`Import error: ${error.message}`);
    }

    task.log(`Importing - ${totalLineCount++} entries imported\r`, true);
  }
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
