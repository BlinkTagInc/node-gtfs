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
import { openDb } from './db.js';
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
  padLeadingZeros,
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

const markRealtimeDataStale = (config, log) => {
  const db = openDb(config);

  log(`Marking GTFS-Realtime data as stale..`);
  db.prepare(`UPDATE vehicle_positions SET isUpdated=0`).run();
  db.prepare(`UPDATE trip_updates SET isUpdated=0`).run();
  db.prepare(`UPDATE stop_times_updates SET isUpdated=0`).run();
  db.prepare(`UPDATE service_alerts SET isUpdated=0`).run();
  db.prepare(`UPDATE service_alert_targets SET isUpdated=0`).run();
  log(`Marked GTFS-Realtime data as stale\r`, true);
};

const cleanStaleRealtimeData = (config, log) => {
  const db = openDb(config);

  log(`Cleaning stale GTFS-RT data..`);
  db.prepare(`DELETE FROM vehicle_positions WHERE isUpdated=0`).run();
  db.prepare(`DELETE FROM trip_updates WHERE isUpdated=0`).run();
  db.prepare(`DELETE FROM stop_times_updates WHERE isUpdated=0`).run();
  db.prepare(`DELETE FROM service_alerts WHERE isUpdated=0`).run();
  db.prepare(`DELETE FROM service_alert_targets WHERE isUpdated=0`).run();
  log(`Cleaned stale GTFS-Realtime data\r`, true);
};

const updateRealtimeData = async (task) => {
  const db = openDb(task);

  const model = {
    vehicle_positions: models.find(
      (x) => x.filenameBase === 'vehicle_positions',
    ),
    trip_updates: models.find((x) => x.filenameBase === 'trip_updates'),
    stop_times_updates: models.find(
      (x) => x.filenameBase === 'stop_times_updates',
    ),
    service_alerts: models.find((x) => x.filenameBase === 'service_alerts'),
    service_alert_targets: models.find(
      (x) => x.filenameBase === 'service_alert_targets',
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
    `Starting GTFS-Realtime import from ${task.realtime_urls.length} urls`,
  );

  for (const realtimeUrl of task.realtime_urls) {
    task.log(`Downloading GTFS-Realtime from ${realtimeUrl}`);
    // eslint-disable-next-line no-await-in-loop
    const tripUpdateData = await downloadGtfsRealtimeData(
      realtimeUrl,
      task.realtime_headers,
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
          getDescendantProp(entity, column.source, column.default),
        ),
      );

      try {
        db.prepare(
          `REPLACE INTO ${model[gtfsRealtimeType].filenameBase} (${
            fields[gtfsRealtimeType]
          }) VALUES (${fieldValues.join(', ')})`,
        ).run();
      } catch (error) {
        task.warn('Import error: ' + error.message);
      }

      // Special processing for tripUpdates
      if (entity.tripUpdate) {
        const stopUpdateArray = [];
        for (const stopUpdate of entity.tripUpdate.stopTimeUpdate) {
          stopUpdate.parent = entity;
          const subValues = model.stop_times_updates.schema.map((column) =>
            sqlString.escape(
              getDescendantProp(stopUpdate, column.source, column.default),
            ),
          );
          stopUpdateArray.push(`(${subValues.join(', ')})`);
          totalLineCount++;
        }

        try {
          db.prepare(
            `REPLACE INTO ${model.stop_times_updates.filenameBase} (${
              fields.stop_times_updates
            }) VALUES ${stopUpdateArray.join(', ')}`,
          ).run();
        } catch (error) {
          task.warn('Import error: ' + error.message);
        }
      }

      // Special processing for serviceAlerts
      if (entity.alert) {
        const alertTargetArray = [];
        for (const informedEntity of entity.alert.informedEntity) {
          informedEntity.parent = entity;
          const subValues = model.service_alert_targets.schema.map((column) =>
            sqlString.escape(
              getDescendantProp(informedEntity, column.source, column.default),
            ),
          );
          alertTargetArray.push(`(${subValues.join(', ')})`);
          totalLineCount++;
        }

        try {
          db.prepare(
            `REPLACE INTO ${model.service_alert_targets.filenameBase} (${
              fields.service_alert_targets
            }) VALUES ${alertTargetArray.join(', ')}`,
          ).run();
        } catch (error) {
          task.warn('Import error: ' + error.message);
        }
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
        // Ignore system directories within zip file
        const folders = files
          .filter((filename) => !['__MACOSX'].includes(filename))
          .map((filename) => path.join(task.downloadDir, filename))
          .filter((source) => lstatSync(source).isDirectory());

        if (folders.length > 1) {
          throw new Error(
            `More than one subfolder found in zip file at \`${task.path}\`. Ensure that .txt files are in the top level of the zip file, or in a single subdirectory.`,
          );
        } else if (folders.length === 0) {
          throw new Error(
            `No .txt files found in \`${task.path}\`. Ensure that .txt files are in the top level of the zip file, or in a single subdirectory.`,
          );
        }

        const subfolderName = folders[0];
        const directoryTextFiles = await getTextFiles(subfolderName);

        if (directoryTextFiles.length === 0) {
          throw new Error(
            `No .txt files found in \`${task.path}\`. Ensure that .txt files are in the top level of the zip file, or in a single subdirectory.`,
          );
        }

        await Promise.all(
          directoryTextFiles.map(async (fileName) =>
            rename(
              path.join(subfolderName, fileName),
              path.join(task.downloadDir, fileName),
            ),
          ),
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
        `Unable to load files from path \`${gtfsPath}\` defined in configuration. Verify that path exists and contains GTFS files.`,
      );
    }
  }
};

const createTables = (db) => {
  for (const model of models) {
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

      const required = column.required ? 'NOT NULL' : '';
      const columnDefault = column.default ? 'DEFAULT ' + column.default : '';
      const columnCollation = column.nocase ? 'COLLATE NOCASE' : '';
      return `${column.name} ${column.type} ${check} ${required} ${columnDefault} ${columnCollation}`;
    });

    // Find Primary Key fields
    const primaryColumns = model.schema.filter((column) => column.primary);

    if (primaryColumns.length > 0) {
      columns.push(
        `PRIMARY KEY (${primaryColumns
          .map((column) => column.name)
          .join(', ')})`,
      );
    }

    db.prepare(`DROP TABLE IF EXISTS ${model.filenameBase};`).run();

    db.prepare(
      `CREATE TABLE ${model.filenameBase} (${columns.join(', ')});`,
    ).run();

    for (const column of model.schema.filter((column) => column.index)) {
      const unique = column.index === 'unique' ? 'UNIQUE' : '';
      db.prepare(
        `CREATE ${unique} INDEX idx_${model.filenameBase}_${column.name} ON ${model.filenameBase} (${column.name});`,
      ).run();
    }
  }
};

const formatLine = (line, model, totalLineCount) => {
  const lineNumber = totalLineCount + 1;

  const formattedLine = {};

  for (const columnSchema of model.schema) {
    const lineValue = line[columnSchema.name];

    if (columnSchema.type === 'integer') {
      // Convert fields that should be integer
      formattedLine[columnSchema.name] = Number.parseInt(lineValue, 10);
    } else if (columnSchema.type === 'real') {
      // Convert fields that should be float
      formattedLine[columnSchema.name] = Number.parseFloat(lineValue);
    } else {
      formattedLine[columnSchema.name] = lineValue;
    }

    if (
      formattedLine[columnSchema.name] === '' ||
      formattedLine[columnSchema.name] === undefined ||
      formattedLine[columnSchema.name] === null ||
      Number.isNaN(formattedLine[columnSchema.name])
    ) {
      // Add null values
      formattedLine[columnSchema.name] = null;
    }

    // Validate required
    if (
      columnSchema.required === true &&
      formattedLine[columnSchema.name] === null
    ) {
      throw new Error(
        `Missing required value in ${model.filenameBase}.txt for ${columnSchema.name} on line ${lineNumber}.`,
      );
    }

    // Validate minimum
    if (
      columnSchema.min !== undefined &&
      formattedLine[columnSchema.name] < columnSchema.min
    ) {
      throw new Error(
        `Invalid value in ${model.filenameBase}.txt for ${columnSchema.name} on line ${lineNumber}: below minimum value of ${columnSchema.min}.`,
      );
    }

    // Validate maximum
    if (
      columnSchema.max !== undefined &&
      formattedLine[columnSchema.name] > columnSchema.max
    ) {
      throw new Error(
        `Invalid value in ${model.filenameBase}.txt for ${columnSchema.name} on line ${lineNumber}: above maximum value of ${columnSchema.max}.`,
      );
    }
  }

  // Convert to midnight timestamp
  const timestampColumnNames = [
    'start_time',
    'end_time',
    'arrival_time',
    'departure_time',
  ];

  for (const timestampColumnName of timestampColumnNames) {
    if (formattedLine[timestampColumnName]) {
      formattedLine[`${timestampColumnName}stamp`] =
        calculateSecondsFromMidnight(formattedLine[timestampColumnName]);

      // Ensure leading zeros for time columns
      formattedLine[timestampColumnName] = padLeadingZeros(
        formattedLine[timestampColumnName],
      );
    }
  }

  return formattedLine;
};

const importLines = (task, lines, model, totalLineCount) => {
  const db = openDb(task);

  if (lines.length === 0) {
    return;
  }

  const linesToImportCount = lines.length;
  const columns = model.schema.filter((column) => column.name !== 'id');
  const placeholders = [];
  const values = [];

  while (lines.length > 0) {
    const line = lines.pop();
    placeholders.push(`(${columns.map(() => '?').join(', ')})`);
    values.push(
      ...columns.map((column) => {
        if (task.prefix !== undefined && column.prefix === true) {
          // Add prefixes to field values if needed
          return `${task.prefix}${line[column.name]}`;
        }

        return line[column.name];
      }),
    );
  }

  try {
    db.prepare(
      `INSERT ${task.ignoreDuplicates ? 'OR IGNORE' : ''} INTO ${
        model.filenameBase
      } (${columns
        .map((column) => column.name)
        .join(', ')}) VALUES ${placeholders.join(',')}`,
    ).run(...values);
  } catch (error) {
    task.warn(
      `Check ${model.filenameBase}.txt for invalid data between lines ${
        totalLineCount - linesToImportCount
      } and ${totalLineCount}.`,
    );
    throw error;
  }

  task.log(
    `Importing - ${model.filenameBase}.txt - ${totalLineCount} lines imported\r`,
    true,
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

        // If the model is a database/gtfs-realtime model then silently exit
        if (model.extension === 'gtfs-realtime') {
          resolve();
          return;
        }

        const filepath = path.join(
          task.downloadDir,
          `${model.filenameBase}.txt`,
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
        const maxInsertVariables = 32_000;
        const parser = parse({
          columns: true,
          relax_quotes: true,
          trim: true,
          skip_empty_lines: true,
          ...task.csvOptions,
        });

        parser.on('readable', () => {
          let record;

          while ((record = parser.read())) {
            try {
              totalLineCount += 1;
              lines.push(formatLine(record, model, totalLineCount));
              // If we have a bunch of lines ready to insert, then do it
              if (lines.length >= maxInsertVariables / model.schema.length) {
                importLines(task, lines, model, totalLineCount);
              }
            } catch (error) {
              reject(error);
            }
          }
        });

        parser.on('end', () => {
          // Insert all remaining lines
          importLines(task, lines, model, totalLineCount);
          resolve();
        });

        parser.on('error', reject);

        createReadStream(filepath).pipe(stripBomStream()).pipe(parser);
      }),
  );

export async function importGtfs(initialConfig) {
  const config = setDefaultConfig(initialConfig);
  validateConfigForImport(config);
  const log = _log(config);
  const logError = _logError(config);
  const logWarning = _logWarning(config);
  try {
    const db = openDb(config);

    const agencyCount = config.agencies.length;
    log(
      `Starting GTFS import for ${pluralize(
        'file',
        agencyCount,
        true,
      )} using SQLite database at ${config.sqlitePath}`,
    );

    createTables(db);

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
        ignoreDuplicates: config.ignoreDuplicates,
        sqlitePath: config.sqlitePath,
        prefix: agency.prefix,
        log,
        warn: logWarning,
        error: logError,
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

    log(
      `Completed GTFS import for ${pluralize('agency', agencyCount, true)}\n`,
    );
  } catch (error) {
    if (error instanceof Error && error.code === 'SQLITE_CANTOPEN') {
      logError(
        `Unable to open sqlite database "${config.sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`,
      );
    }

    throw error;
  }
}

export async function updateGtfsRealtime(initialConfig) {
  const config = setDefaultConfig(initialConfig);
  validateConfigForImport(config);
  const log = _log(config);
  const logError = _logError(config);
  const logWarning = _logWarning(config);

  try {
    openDb(config);

    const agencyCount = config.agencies.length;
    log(
      `Starting GTFS-Realtime refresh for ${pluralize(
        'agencies',
        agencyCount,
        true,
      )} using SQLite database at ${config.sqlitePath}`,
    );

    markRealtimeDataStale(config, log);

    await Promise.all(
      config.agencies.map(async (agency) => {
        if (!agency.realtimeUrls) {
          return;
        }

        const task = {
          realtime_headers: agency.realtimeHeaders || false,
          realtime_urls: agency.realtimeUrls || false,
          sqlitePath: config.sqlitePath,
          log,
          warn: logWarning,
          error: logError,
        };

        await updateRealtimeData(task);
      }),
    );

    cleanStaleRealtimeData(config, log);
    log(
      `Completed GTFS-Realtime refresh for ${pluralize(
        'agencies',
        agencyCount,
        true,
      )}\n`,
    );
  } catch (error) {
    if (error instanceof Error && error.code === 'SQLITE_CANTOPEN') {
      logError(
        `Unable to open sqlite database "${config.sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`,
      );
    }

    throw error;
  }
}
