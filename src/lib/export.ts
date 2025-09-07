import path from 'node:path';
import { writeFile } from 'node:fs/promises';

import { without, compact } from 'lodash-es';
import { stringify } from 'csv-stringify';
import sqlString from 'sqlstring-sqlite';
import Database from 'better-sqlite3';
import mapSeries from 'promise-map-series';

import * as models from '../models/models.ts';
import { openDb } from './db.ts';
import { prepDirectory, generateFolderName, untildify } from './file-utils.ts';
import { log, logWarning } from './log-utils.ts';
import { formatCurrency, pluralize, setDefaultConfig } from './utils.ts';

import { Config, Model, SqlValue } from '../types/global_interfaces.ts';

const getAgencies = (db: Database.Database, config: Config) => {
  try {
    return db.prepare('SELECT agency_name FROM agency;').all() as {
      agency_name: string;
    }[];
  } catch {
    if (config.sqlitePath === ':memory:') {
      throw new Error(
        'No agencies found in SQLite. You are using an in-memory database - if running this from command line be sure to specify a value for `sqlitePath` in config.json other than ":memory:".',
      );
    }

    throw new Error(
      'No agencies found in SQLite. Be sure to first import data into SQLite using `gtfs-import` or `importGtfs(config);`',
    );
  }
};

export const exportGtfs = async (initialConfig: Config) => {
  const config = setDefaultConfig(initialConfig);
  const db = openDb(config);

  // Get agency name for export folder from first line of agency.txt

  const agencies = getAgencies(db, config);
  const agencyCount = agencies.length;
  if (agencyCount === 0) {
    throw new Error(
      'No agencies found in SQLite. Be sure to first import data into SQLite using `gtfs-import` or `importGtfs(config);`',
    );
  } else if (agencyCount > 1) {
    logWarning(config)(
      'More than one agency is defined in config.json. Export will merge all into one GTFS file.',
    );
  }

  log(config)(
    `Starting GTFS export for ${pluralize(
      'agency',
      'agencies',
      agencyCount,
    )} using SQLite database at ${config.sqlitePath}`,
  );

  const folderName = generateFolderName(agencies[0].agency_name);
  const defaultExportPath = path.join(process.cwd(), 'gtfs-export', folderName);
  const exportPath = untildify(config.exportPath || defaultExportPath);

  await prepDirectory(exportPath);

  // Loop through each GTFS file
  const modelsToExport = (Object.values(models) as Model[]).filter(
    (model) => model.extension !== 'gtfs-realtime',
  );
  const exportedFiles = await mapSeries(
    modelsToExport,
    async (model: Model) => {
      const filePath = path.join(
        exportPath,
        `${model.filenameBase}.${model.filenameExtension}`,
      );
      const tableName = sqlString.escapeId(model.filenameBase);
      const lines = db.prepare(`SELECT * FROM ${tableName};`).all() as Array<
        Record<string, SqlValue>
      >;

      if (!lines || lines.length === 0) {
        if (!model.nonstandard) {
          log(config)(
            `Skipping (no data) - ${model.filenameBase}.${model.filenameExtension}\r`,
          );
        }

        return;
      }

      if (model.filenameExtension === 'txt') {
        const excludeColumns = [];

        // If no routes have values for agency_id, add it to the excludeColumns list
        if (model.filenameBase === 'routes') {
          const routesWithAgencyId = db
            .prepare(
              'SELECT agency_id FROM routes WHERE agency_id IS NOT NULL;',
            )
            .all();
          if (!routesWithAgencyId || routesWithAgencyId.length === 0) {
            excludeColumns.push('agency_id');
          }
        } else if (model.filenameBase === 'fare_attributes') {
          for (const line of lines) {
            line.price = formatCurrency(
              line.price as number,
              line.currency_type as string,
            );
          }
        } else if (model.filenameBase === 'fare_products') {
          for (const line of lines) {
            line.amount = formatCurrency(
              line.amount as number,
              line.currency as string,
            );
          }
        }

        const columns = without(
          model.schema.map((column) => column.name),
          ...excludeColumns,
        );
        const fileText = await stringify(lines, { columns, header: true });
        await writeFile(filePath, fileText);
      } else if (model.filenameExtension === 'geojson') {
        const fileText = lines?.[0].geojson ?? '';
        await writeFile(filePath, fileText as string);
      } else {
        throw new Error(
          `Unexpected filename extension: ${model.filenameExtension}`,
        );
      }

      log(config)(
        `Exporting - ${model.filenameBase}.${model.filenameExtension}\r`,
      );

      return `${model.filenameBase}.${model.filenameExtension}`;
    },
  );

  if (compact(exportedFiles).length === 0) {
    log(config)(
      'No GTFS data exported. Be sure to first import data into SQLite.',
    );
    return;
  }

  log(config)(`Completed GTFS export to ${exportPath}`);

  log(config)(
    `Completed GTFS export for ${pluralize('agency', 'agencies', agencyCount)}\n`,
  );
};
