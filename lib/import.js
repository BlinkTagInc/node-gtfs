import path from 'node:path';
import { createReadStream, existsSync, lstatSync } from 'node:fs';
import { readdir, rename, writeFile } from 'node:fs/promises';
import copy from 'recursive-copy';
import fetch from 'node-fetch';
import { parse } from 'csv-parse';
import pluralize from 'pluralize';
import stripBomStream from 'strip-bom-stream';
import { dir } from 'tmp-promise';
import untildify from 'untildify';
import mapSeries from 'promise-map-series';
import gtfsrt from 'gtfs-realtime-bindings';
import sqlString from 'sqlstring-sqlite';

import models from '../models/models.js';
import { openDb, setupDb } from './db.js';
import { unzip } from './file-utils.js';
import {
  log as _log,
  logError as _logError,
  logWarning as _logWarning,
} from './log-utils.js';
import {
  calculateSecondsFromMidnight,
  setDefaultConfig,
  validateConfigForImport,
  convertLongTimeToDate,
} from './utils.js';

const downloadFiles = async (task) => {
  task.log(`Downloading GTFS from ${task.agency_url}`);

  task.path = `${task.downloadDir}/gtfs.zip`;

  const response = await fetch(task.agency_url, {
    method: 'GET',
    headers: task.headers || {},
  });

  if (response.status !== 200) {
    throw new Error('Couldn’t download files');
  }

  const buffer = await response.arrayBuffer();

  await writeFile(task.path, Buffer.from(buffer));
  task.log('Download successful');
};

const downloadGtfsRealtimeData = async (url, headers) => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { ...{}, ...headers, ...{ 'Accept-Encoding': 'gzip' } },
  });

  if (response.status !== 200) {
    throw new Error('Couldn’t download files');
  }

  const buffer = await response.arrayBuffer();
  return gtfsrt.transit_realtime.FeedMessage.decode(Buffer.from(buffer));
};

function getDescendantProp(obj, desc, defaultvalue) {
  if (desc === undefined) return defaultvalue;
  const arr = desc.split('.');
  while (arr.length) {
    const nextKey = arr.shift();
    if (nextKey.includes('[')) {
      const arrayKey = nextKey.match(/(\w*)\[(\d+)\]/);
      if (!obj[arrayKey[1]]) return defaultvalue;
      if (!obj[arrayKey[1]][arrayKey[2]]) return defaultvalue;
      obj = obj[arrayKey[1]][arrayKey[2]];
    } else {
      if (!obj[nextKey]) return defaultvalue;
      obj = obj[nextKey];
    }
  }

  if (obj.__isLong__) return convertLongTimeToDate(obj);

  return obj;
}

const markRealtimeDataStale = async (db, log) => {
  const vehiclePositionModel = models.find(
    (x) => x.filenameBase === 'vehicle_positions'
  );
  const tripUpdatesModel = models.find(
    (x) => x.filenameBase === 'trip_updates'
  );
  const stopTimesUpdatesModel = models.find(
    (x) => x.filenameBase === 'stop_times_updates'
  );
  const serviceAlertsModel = models.find(
    (x) => x.filenameBase === 'service_alerts'
  );
  const serviceAlertTargetsModel = models.find(
    (x) => x.filenameBase === 'service_alert_targets'
  );

  // Mark all data as stale
  log(`Marking GTFS-Realtime data as stale..`);
  await db.run(`UPDATE ${vehiclePositionModel.filenameBase} SET isUpdated=0`);
  await db.run(`UPDATE ${tripUpdatesModel.filenameBase} SET isUpdated=0`);
  await db.run(`UPDATE ${stopTimesUpdatesModel.filenameBase} SET isUpdated=0`);
  await db.run(`UPDATE ${serviceAlertsModel.filenameBase} SET isUpdated=0`);
  await db.run(
    `UPDATE ${serviceAlertTargetsModel.filenameBase} SET isUpdated=0`
  );
  log(`Marked GTFS-Realtime data as stale\r`, true);
};

const cleanStaleRealtimeData = async (db, log) => {
  const vehiclePositionModel = models.find(
    (x) => x.filenameBase === 'vehicle_positions'
  );
  const tripUpdatesModel = models.find(
    (x) => x.filenameBase === 'trip_updates'
  );
  const stopTimesUpdatesModel = models.find(
    (x) => x.filenameBase === 'stop_times_updates'
  );
  const serviceAlertsModel = models.find(
    (x) => x.filenameBase === 'service_alerts'
  );
  const serviceAlertTargetsModel = models.find(
    (x) => x.filenameBase === 'service_alert_targets'
  );

  log(`Cleaning stale GRFS-RT data..`);
  await db.run(
    `DELETE FROM ${vehiclePositionModel.filenameBase} WHERE isUpdated=0`
  );
  await db.run(
    `DELETE FROM ${tripUpdatesModel.filenameBase} WHERE isUpdated=0`
  );
  await db.run(
    `DELETE FROM ${stopTimesUpdatesModel.filenameBase} WHERE isUpdated=0`
  );
  await db.run(
    `DELETE FROM ${serviceAlertsModel.filenameBase} WHERE isUpdated=0`
  );
  await db.run(
    `DELETE FROM ${serviceAlertTargetsModel.filenameBase} WHERE isUpdated=0`
  );
  log(`Cleaned stale GTFS-Realtime data\r`, true);
};

const updateRealtimeData = async (task) => {
  const model = {
    vehicle_positions: models.find(
      (x) => x.filenameBase === 'vehicle_positions'
    ),
    trip_updates: models.find((x) => x.filenameBase === 'trip_updates'),
    stop_times_updates: models.find(
      (x) => x.filenameBase === 'stop_times_updates'
    ),
    service_alerts: models.find((x) => x.filenameBase === 'service_alerts'),
    service_alert_targets: models.find(
      (x) => x.filenameBase === 'service_alert_targets'
    ),
  };

  const fields = {
    vehicle_positions: model.vehicle_positions.schema
      .map((column) => column.name)
      .join(', '),
    trip_updates: model.trip_updates.schema
      .map((column) => column.name)
      .join(', '),
    stop_times_updates: model.stop_times_updates.schema
      .map((column) => column.name)
      .join(', '),
    service_alerts: model.service_alerts.schema
      .map((column) => column.name)
      .join(', '),
    service_alert_targets: model.service_alert_targets.schema
      .map((column) => column.name)
      .join(', '),
  };

  task.log(
    `Starting GTFS-Realtime import from ${task.realtime_urls.length} urls`
  );

  for (const realtimeUrl of task.realtime_urls) {
    task.log(`Downloading GTFS-Realtime from ${realtimeUrl}`);
    // eslint-disable-next-line no-await-in-loop
    const tripUpdateData = await downloadGtfsRealtimeData(
      realtimeUrl,
      task.realtime_headers
    );
    task.log(`Download successful`);

    let totalLineCount = 0;
    for (const entity of tripUpdateData.entity) {
      // Determine the type of GTFS-Realtime
      let gtfsRealtimeType = null;
      if (entity.vehicle) {
        gtfsRealtimeType = 'vehicle_positions';
      }

      if (entity.tripUpdate) {
        gtfsRealtimeType = 'trip_updates';
      }

      if (entity.alert) {
        gtfsRealtimeType = 'service_alerts';
      }

      if (!gtfsRealtimeType) {
        break;
      }

      // Do base processing
      const fieldValues = model[gtfsRealtimeType].schema.map((column) =>
        sqlString.escape(
          getDescendantProp(entity, column.source, column.default)
        )
      );

      // eslint-disable-next-line no-await-in-loop
      await task.db
        .run(
          `REPLACE INTO ${model[gtfsRealtimeType].filenameBase} (${
            fields[gtfsRealtimeType]
          }) VALUES (${fieldValues.join(', ')})`
        )
        .catch((error) => {
          task.warn('Import error: ' + error.message);
        });

      // Special processing for tripUpdates
      if (entity.tripUpdate) {
        const stopUpdateArray = [];
        for (const stopUpdate of entity.tripUpdate.stopTimeUpdate) {
          stopUpdate.parent = entity;
          const subValues = model.stop_times_updates.schema.map((column) =>
            sqlString.escape(
              getDescendantProp(stopUpdate, column.source, column.default)
            )
          );
          stopUpdateArray.push(`(${subValues.join(', ')})`);
          totalLineCount++;
        }

        // eslint-disable-next-line no-await-in-loop
        await task.db
          .run(
            `REPLACE INTO ${model.stop_times_updates.filenameBase} (${
              fields.stop_times_updates
            }) VALUES ${stopUpdateArray.join(', ')}`
          )
          .catch((error) => {
            task.warn('Import error: ' + error.message);
          });
      }

      // Special processing for serviceAlerts
      if (entity.alert) {
        const alertTargetArray = [];
        for (const informedEntity of entity.alert.informedEntity) {
          informedEntity.parent = entity;
          const subValues = model.service_alert_targets.schema.map((column) =>
            sqlString.escape(
              getDescendantProp(informedEntity, column.source, column.default)
            )
          );
          alertTargetArray.push(`(${subValues.join(', ')})`);
          totalLineCount++;
        }

        // eslint-disable-next-line no-await-in-loop
        await task.db
          .run(
            `REPLACE INTO ${model.service_alert_targets.filenameBase} (${
              fields.service_alert_targets
            }) VALUES ${alertTargetArray.join(', ')}`
          )
          .catch((error) => {
            task.warn('Import error: ' + error.message);
          });
      }

      task.log(`Importing - ${totalLineCount++} entries imported\r`, true);
    }
  }

  task.log(`GTFS-Realtime data import complete`);
};

const getTextFiles = async (folderPath) => {
  const files = await readdir(folderPath);
  return files.filter((filename) => filename.slice(-3) === 'txt');
};

const readFiles = async (task) => {
  const gtfsPath = untildify(task.path);
  task.log(`Importing GTFS from ${task.path}\r`);
  if (path.extname(gtfsPath) === '.zip') {
    try {
      await unzip(gtfsPath, task.downloadDir);
      const textFiles = await getTextFiles(task.downloadDir);

      // If no .txt files in this directory, check for subdirectories and copy them here
      if (textFiles.length === 0) {
        const files = await readdir(task.downloadDir);
        const folders = files
          .map((filename) => path.join(task.downloadDir, filename))
          .filter((source) => lstatSync(source).isDirectory());

        if (folders.length > 1) {
          throw new Error(
            `More than one subfolder found in zip file at \`${task.path}\`. Ensure that .txt files are in the top level of the zip file, or in a single subdirectory.`
          );
        } else if (folders.length === 0) {
          throw new Error(
            `No .txt files found in \`${task.path}\`. Ensure that .txt files are in the top level of the zip file, or in a single subdirectory.`
          );
        }

        const subfolderName = folders[0];
        const directoryTextFiles = await getTextFiles(subfolderName);

        if (directoryTextFiles.length === 0) {
          throw new Error(
            `No .txt files found in \`${task.path}\`. Ensure that .txt files are in the top level of the zip file, or in a single subdirectory.`
          );
        }

        await Promise.all(
          directoryTextFiles.map(async (fileName) =>
            rename(
              path.join(subfolderName, fileName),
              path.join(task.downloadDir, fileName)
            )
          )
        );
      }
    } catch (error) {
      task.error(error);
      console.error(error);
      throw new Error(`Unable to unzip file ${task.path}`);
    }
  } else {
    // Local file is unzipped, just copy it from there.
    try {
      await copy(gtfsPath, task.downloadDir);
    } catch {
      throw new Error(
        `Unable to load files from path \`${gtfsPath}\` defined in configuration. Verify that path exists and contains GTFS files.`
      );
    }
  }
};

const deleteTables = (db) =>
  Promise.all(
    models.map((model) => db.run(`DROP TABLE IF EXISTS ${model.filenameBase};`))
  );

const createTables = (db) =>
  Promise.all(
    models.map(async (model) => {
      if (!model.schema) {
        return;
      }

      const columns = model.schema.map((column) => {
        let check = '';
        if (column.min !== undefined && column.max) {
          check = `CHECK( ${column.name} >= ${column.min} AND ${column.name} <= ${column.max} )`;
        } else if (column.min) {
          check = `CHECK( ${column.name} >= ${column.min} )`;
        } else if (column.max) {
          check = `CHECK( ${column.name} <= ${column.max} )`;
        }

        const primary = column.primary ? 'PRIMARY KEY' : '';
        const required = column.required ? 'NOT NULL' : '';
        const columnDefault = column.default ? 'DEFAULT ' + column.default : '';
        const columnCollation = column.nocase ? 'COLLATE NOCASE' : '';
        return `${column.name} ${column.type} ${check} ${primary} ${required} ${columnDefault} ${columnCollation}`;
      });

      await db.run(
        `CREATE TABLE ${model.filenameBase} (${columns.join(', ')});`
      );

      await Promise.all(
        model.schema.map(async (column) => {
          if (column.index) {
            const unique = column.index === 'unique' ? 'UNIQUE' : '';
            await db.run(
              `CREATE ${unique} INDEX idx_${model.filenameBase}_${column.name} ON ${model.filenameBase} (${column.name});`
            );
          }
        })
      );
    })
  );

const formatLine = (line, model, totalLineCount) => {
  const lineNumber = totalLineCount + 1;
  for (const fieldName of Object.keys(line)) {
    const columnSchema = model.schema.find(
      (schema) => schema.name === fieldName
    );

    // Remove columns not part of model
    if (!columnSchema) {
      delete line[fieldName];
      continue;
    }

    // Remove null values
    if (line[fieldName] === null || line[fieldName] === '') {
      delete line[fieldName];
    }

    // Convert fields that should be integer
    if (columnSchema.type === 'integer') {
      const value = Number.parseInt(line[fieldName], 10);

      if (Number.isNaN(value)) {
        delete line[fieldName];
      } else {
        line[fieldName] = value;
      }
    }

    // Convert fields that should be float
    if (columnSchema.type === 'real') {
      const value = Number.parseFloat(line[fieldName]);

      if (Number.isNaN(value)) {
        delete line[fieldName];
      } else {
        line[fieldName] = value;
      }
    }

    // Validate required
    if (
      columnSchema.required === true &&
      (line[fieldName] === undefined || line[fieldName] === '')
    ) {
      throw new Error(
        `Missing required value in ${model.filenameBase}.txt for ${fieldName} on line ${lineNumber}.`
      );
    }

    // Validate minimum
    if (columnSchema.min !== undefined && line[fieldName] < columnSchema.min) {
      throw new Error(
        `Invalid value in ${model.filenameBase}.txt for ${fieldName} on line ${lineNumber}: below minimum value of ${columnSchema.min}.`
      );
    }

    // Validate maximum
    if (columnSchema.max !== undefined && line[fieldName] > columnSchema.max) {
      throw new Error(
        `Invalid value in ${model.filenameBase}.txt for ${fieldName} on line ${lineNumber}: above maximum value of ${columnSchema.max}.`
      );
    }
  }

  // Convert to midnight timestamp
  const timestampFormat = [
    'start_time',
    'end_time',
    'arrival_time',
    'departure_time',
  ];

  for (const fieldName of timestampFormat) {
    if (line[fieldName]) {
      line[`${fieldName}stamp`] = calculateSecondsFromMidnight(line[fieldName]);
    }
  }

  return line;
};

const importLines = async (task, lines, model, totalLineCount) => {
  if (lines.length === 0) {
    return;
  }

  const linesToImportCount = lines.length;
  const fieldNames = model.schema.map((column) => column.name);
  const placeholders = [];
  const values = [];

  while (lines.length > 0) {
    const line = lines.pop();
    placeholders.push(`(${fieldNames.map(() => '?').join(', ')})`);
    for (const fieldName of fieldNames) {
      values.push(line[fieldName]);
    }
  }

  try {
    await task.db.run(
      `INSERT INTO ${model.filenameBase}(${fieldNames.join(
        ', '
      )}) VALUES${placeholders.join(',')}`,
      values
    );
  } catch (error) {
    task.warn(
      `Check ${model.filenameBase}.txt for invalid data between lines ${
        totalLineCount - linesToImportCount
      } and ${totalLineCount}.`
    );
    throw error;
  }

  task.log(
    `Importing - ${model.filenameBase}.txt - ${totalLineCount} lines imported\r`,
    true
  );
};

const importFiles = (task) =>
  mapSeries(
    models,
    (model) =>
      new Promise((resolve, reject) => {
        // Loop through each GTFS file
        // Filter out excluded files from config
        if (task.exclude && task.exclude.includes(model.filenameBase)) {
          task.log(`Skipping - ${model.filenameBase}.txt\r`);
          resolve();
          return;
        }

        // If the model is a database/gtfs-realtime model then just silently exit as we dont really care here
        if (model.extension === 'gtfs-realtime') {
          resolve();
          return;
        }

        const filepath = path.join(
          task.downloadDir,
          `${model.filenameBase}.txt`
        );

        if (!existsSync(filepath)) {
          if (!model.nonstandard) {
            task.log(`Importing - ${model.filenameBase}.txt - No file found\r`);
          }

          resolve();
          return;
        }

        task.log(`Importing - ${model.filenameBase}.txt\r`);

        const lines = [];
        let totalLineCount = 0;
        const maxInsertVariables = 800;
        const parser = parse({
          columns: true,
          relax: true,
          trim: true,
          skip_empty_lines: true,
          ...task.csvOptions,
        });

        parser.on('readable', async () => {
          let record;

          while ((record = parser.read())) {
            try {
              totalLineCount += 1;
              lines.push(formatLine(record, model, totalLineCount));

              // If we have a bunch of lines ready to insert, then do it
              if (lines.length >= maxInsertVariables / model.schema.length) {
                /* eslint-disable-next-line no-await-in-loop */
                await importLines(task, lines, model, totalLineCount);
              }
            } catch (error) {
              reject(error);
            }
          }
        });

        parser.on('end', async () => {
          // Insert all remaining lines
          await importLines(task, lines, model, totalLineCount).catch(reject);
          resolve();
        });

        parser.on('error', reject);

        createReadStream(filepath).pipe(stripBomStream()).pipe(parser);
      })
  );

export async function importGtfs(initialConfig) {
  const config = setDefaultConfig(initialConfig);
  validateConfigForImport(config);
  const log = _log(config);
  const logError = _logError(config);
  const logWarning = _logWarning(config);
  const db = await openDb(config).catch((error) => {
    if (error instanceof Error && error.code === 'SQLITE_CANTOPEN') {
      logError(
        `Unable to open sqlite database "${config.sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`
      );
    }

    throw error;
  });

  const agencyCount = config.agencies.length;
  log(
    `Starting GTFS import for ${pluralize(
      'file',
      agencyCount,
      true
    )} using SQLite database at ${config.sqlitePath}`
  );

  await deleteTables(db);
  await createTables(db);

  await setupDb(db);

  await mapSeries(config.agencies, async (agency) => {
    const { path, cleanup } = await dir({ unsafeCleanup: true });

    const task = {
      exclude: agency.exclude,
      agency_url: agency.url,
      headers: agency.headers || false,
      realtime_headers: agency.realtimeHeaders || false,
      realtime_urls: agency.realtimeUrls || false,
      downloadDir: path,
      path: agency.path,
      csvOptions: config.csvOptions || {},
      db,
      log(message, overwrite) {
        log(message, overwrite);
      },
      warn(message) {
        logWarning(message);
      },
      error(message) {
        logError(message);
      },
    };

    if (task.agency_url) {
      await downloadFiles(task);
    }

    await readFiles(task);
    await importFiles(task);

    if (task.realtime_urls) {
      await updateRealtimeData(task);
    }

    cleanup();
  });

  log(`Completed GTFS import for ${pluralize('agency', agencyCount, true)}\n`);
}

export async function updateGtfsRealtime(initialConfig) {
  const config = setDefaultConfig(initialConfig);
  validateConfigForImport(config);
  const log = _log(config);
  const logError = _logError(config);
  const logWarning = _logWarning(config);
  const db = await openDb(config).catch((error) => {
    if (error instanceof Error && error.code === 'SQLITE_CANTOPEN') {
      logError(
        `Unable to open sqlite database "${config.sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`
      );
    }

    throw error;
  });

  const agencyCount = config.agencies.length;
  log(
    `Starting GTFS-Realtime refresh for ${pluralize(
      'agencies',
      agencyCount,
      true
    )} using SQLite database at ${config.sqlitePath}`
  );

  await markRealtimeDataStale(db, log);

  await mapSeries(config.agencies, async (agency) => {
    const task = {
      realtime_headers: agency.realtimeHeaders || false,
      realtime_urls: agency.realtimeUrls || false,
      db,
      log(message, overwrite) {
        log(message, overwrite);
      },
      warn(message) {
        logWarning(message);
      },
      error(message) {
        logError(message);
      },
    };

    if (task.realtime_urls) {
      await updateRealtimeData(task);
    }
  });

  await cleanStaleRealtimeData(db, log);
  log(
    `Completed GTFS-Realtime refresh for ${pluralize(
      'agencies',
      agencyCount,
      true
    )}\n`
  );
}
