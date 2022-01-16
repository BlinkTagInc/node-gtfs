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
} from './utils.js';

const downloadFiles = async (task) => {
  task.log(`Downloading GTFS from ${task.agency_url}`);

  task.path = `${task.downloadDir}/gtfs.zip`;

  const response = await fetch(task.agency_url, {
    method: 'GET',
    headers: task.agency_headers || {},
  });

  if (response.status !== 200) {
    throw new Error('Couldn’t download files');
  }

  const buffer = await response.arrayBuffer();

  await writeFile(task.path, Buffer.from(buffer));
  task.log('Download successful');
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
        const columnCollation = column.nocase ? 'COLLATE NOCASE' : ''
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

const importGtfs = async (initialConfig) => {
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
      agency_headers: agency.headers || false,
      downloadDir: path,
      path: agency.path,
      csvOptions: config.csvOptions || {},
      db,
      log: (message, overwrite) => {
        log(message, overwrite);
      },
      warn: (message) => {
        logWarning(message);
      },
      error: (message) => {
        logError(message);
      },
    };

    if (task.agency_url) {
      await downloadFiles(task);
    }

    await readFiles(task);
    await importFiles(task);

    cleanup();
    task.log('Completed GTFS import');
  });

  log(`Completed GTFS import for ${pluralize('file', agencyCount, true)}\n`);
};

export default importGtfs;
