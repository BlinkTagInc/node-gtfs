#!/usr/bin/env node

import {
  CONFIG_PATH_FLAG,
  LOG_LEVEL_FLAG,
  SQLITE_PATH_FLAG,
  parseFlags,
} from './cli-utils.ts';
import { getConfig } from '../lib/file-utils.ts';
import { handleFatalError } from '../reporting/fatal.ts';
import { exportGtfs } from '../index.ts';
import type { Config } from '../types/global_interfaces.ts';

const setupExport = async () => {
  const values = parseFlags(
    'gtfs-export',
    'Export GTFS from a SQLite database back into csv files.',
    [CONFIG_PATH_FLAG, SQLITE_PATH_FLAG, LOG_LEVEL_FLAG],
  );

  const config = await getConfig(values);
  await exportGtfs(config as Config);
  process.exit();
};

setupExport().catch(handleFatalError);
