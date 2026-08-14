#!/usr/bin/env node

import {
  CONFIG_PATH_FLAG,
  LOG_LEVEL_FLAG,
  SQLITE_PATH_FLAG,
  parseFlags,
} from './cli-utils.ts';
import { getConfig } from '../lib/file-utils.ts';
import { handleFatalError } from '../reporting/fatal.ts';
import { closeDb, importGtfs, openDb } from '../index.ts';
import type { Config } from '../types/global_interfaces.ts';

const setupImport = async () => {
  const values = parseFlags(
    'gtfs-import',
    'Import GTFS into a SQLite database.',
    [
      CONFIG_PATH_FLAG,
      {
        name: 'gtfsPath',
        type: 'string',
        value: 'path',
        description: 'Path to GTFS, zipped or unzipped',
      },
      {
        name: 'gtfsUrl',
        type: 'string',
        value: 'url',
        description: 'URL of a zipped GTFS file',
      },
      SQLITE_PATH_FLAG,
      LOG_LEVEL_FLAG,
    ],
  );

  const config = await getConfig(values);
  await importGtfs(config as Config);

  const db = openDb(config);
  if (db.name !== ':memory:') {
    closeDb(db);
  }

  process.exit();
};

setupImport().catch(handleFatalError);
