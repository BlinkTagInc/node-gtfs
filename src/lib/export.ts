import path from 'node:path';
import { writeFile } from 'node:fs/promises';

import { without, compact } from 'lodash-es';
import { stringify } from 'csv-stringify';
import Database from 'better-sqlite3';

import { fileBackedTables } from '../schema/table-registry.ts';
import { openDb } from './db.ts';
import { prepDirectory, generateFolderName, untildify } from './file-utils.ts';
import {
  escapeIdentifier,
  formatCurrency,
  mapSeries,
  applyConfigDefaults,
} from './utils.ts';

import type { GtfsExportConfig } from '../types/config.ts';
import type { DatabaseResultValue } from '../types/query.ts';
import { log, report, status } from '../reporting/report.ts';
import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from './errors.ts';
import {
  formatCount,
  formatFileCount,
  formatFileList,
  pluralize,
} from '../reporting/format.ts';

const getAgencies = (db: Database.Database, config: GtfsExportConfig) => {
  try {
    return db.prepare('SELECT agency_name FROM agency;').all() as {
      agency_name: string;
    }[];
  } catch {
    if (config.sqlitePath === ':memory:') {
      throw new GtfsError(
        'No agencies found in SQLite. You are using an in-memory database - if running this from command line be sure to specify a value for `sqlitePath` in config.json other than ":memory:".',
        {
          code: GtfsErrorCode.GTFS_CONFIG_INVALID,
          category: GtfsErrorCategory.CONFIG,
        },
      );
    }

    throw new GtfsError(
      'No agencies found in SQLite. Be sure to first import data into SQLite using `gtfs-import` or `importGtfs(config);`',
      {
        code: GtfsErrorCode.GTFS_QUERY_INVALID,
        category: GtfsErrorCategory.DATABASE,
      },
    );
  }
};

export const exportGtfs = async (initialConfig: GtfsExportConfig) => {
  const config = applyConfigDefaults(initialConfig, {
    sqlitePath: ':memory:',
  });
  const db = openDb(config);
  const startTime = process.hrtime.bigint();

  // Get agency name for export folder from first line of agency.txt

  const agencies = getAgencies(db, config);
  const agencyCount = agencies.length;
  if (agencyCount === 0) {
    throw new GtfsError(
      'No agencies found in SQLite. Be sure to first import data into SQLite using `gtfs-import` or `importGtfs(config);`',
      {
        code: GtfsErrorCode.GTFS_QUERY_INVALID,
        category: GtfsErrorCategory.DATABASE,
      },
    );
  } else if (agencyCount > 1) {
    log(
      config,
      'warning',
      'More than one agency is defined in config.json. Export will merge all into one GTFS file.',
    );
  }

  report(config, {
    type: 'run:start',
    task: 'export',
    agencyCount,
    sqlitePath: config.sqlitePath ?? ':memory:',
  });

  const folderName = generateFolderName(agencies[0].agency_name);
  const defaultExportPath = path.join(process.cwd(), 'gtfs-export', folderName);
  const exportPath = untildify(config.exportPath || defaultExportPath);

  await prepDirectory(exportPath);

  // Loop through each GTFS file
  const empty: string[] = [];
  let filesExported = 0;
  let rowsExported = 0;

  status(config, 'Exported');

  const exportedFiles = await mapSeries(fileBackedTables, async (table) => {
    const filePath = path.join(exportPath, table.file);
    const tableName = escapeIdentifier(table.name);
    const lines = db.prepare(`SELECT * FROM ${tableName};`).all() as Array<
      Record<string, DatabaseResultValue>
    >;

    if (!lines || lines.length === 0) {
      if (table.namespace === 'gtfs-schedule') {
        empty.push(table.file);
      }

      return;
    }

    const fileExtension = path.extname(table.file).slice(1);

    if (fileExtension === 'txt') {
      const excludeColumns = [];

      // Omit an unused optional agency_id column.
      if (table.name === 'routes') {
        const routesWithAgencyId = db
          .prepare('SELECT agency_id FROM routes WHERE agency_id IS NOT NULL;')
          .all();
        if (!routesWithAgencyId || routesWithAgencyId.length === 0) {
          excludeColumns.push('agency_id');
        }
      } else if (table.name === 'fare_attributes') {
        for (const line of lines) {
          line.price = formatCurrency(
            line.price as number,
            line.currency_type as string,
          );
        }
      } else if (table.name === 'fare_products') {
        for (const line of lines) {
          line.amount = formatCurrency(
            line.amount as number,
            line.currency as string,
          );
        }
      }

      const columns = without(
        table.columns.map((column) => column.name),
        ...excludeColumns,
      );
      const fileText = await stringify(lines, { columns, header: true });
      await writeFile(filePath, fileText);
    } else if (fileExtension === 'geojson') {
      const fileText = lines?.[0].geojson ?? '';
      await writeFile(filePath, fileText as string);
    } else {
      throw new Error(`Unexpected filename extension: ${fileExtension}`);
    }

    const filename = table.file;

    filesExported += 1;
    rowsExported += lines.length;
    status(config, formatFileCount(filename, lines.length));

    return filename;
  });

  if (compact(exportedFiles).length === 0) {
    log(
      config,
      'warning',
      'No GTFS data exported. Be sure to first import data into SQLite.',
    );
    return;
  }

  if (empty.length > 0) {
    status(config, formatFileList('No data to export', empty));
  }

  report(config, {
    type: 'run:complete',
    task: 'export',
    elapsedSeconds: Number(process.hrtime.bigint() - startTime) / 1_000_000_000,
    destination: exportPath,
    summary: `${pluralize('file', 'files', filesExported)}, ${formatCount(rowsExported)} rows`,
  });
};
