#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { getConfig } from '../lib/file-utils.ts';
import { handleFatalError } from '../reporting/fatal.ts';
import { closeDb, importGtfs, openDb } from '../index.ts';
import type { Config } from '../types/global_interfaces.ts';

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 --configPath ./config.json')
  .help()
  .option('c', {
    alias: 'configPath',
    describe: 'Path to config file',
    type: 'string',
  })
  .option('gtfsPath', {
    describe: 'Path to gtfs (zipped or unzipped)',
    type: 'string',
  })
  .option('gtfsUrl', {
    describe: 'URL of gtfs file',
    type: 'string',
  })
  .option('sqlitePath', {
    describe: 'Path to SQLite database',
    type: 'string',
  })
  .parseSync();

const setupImport = async () => {
  const config = await getConfig(argv);
  await importGtfs(config as Config);

  const db = openDb(config);
  if (db.name !== ':memory:') {
    closeDb(db);
  }
  process.exit();
};

setupImport().catch(handleFatalError);
