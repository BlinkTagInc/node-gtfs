#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { getConfig } from '../lib/file-utils.js';
import { formatError } from '../lib/log-utils.js';
import { exportGtfs } from '../lib/gtfs.js';

const { argv } = yargs(hideBin(process.argv))
  .usage('Usage: $0 --configPath ./config.json')
  .help()
  .option('c', {
    alias: 'configPath',
    describe: 'Path to config file',
    type: 'string',
  })
  .option('sqlitePath', {
    describe: 'Path to SQLite database',
    type: 'string',
  })
  .option('exportPath', {
    describe: 'Path where GTFS export should go',
    type: 'string',
  });

const handleError = (error = 'Unknown Error') => {
  process.stdout.write(`\n${formatError(error)}\n`);
  process.exit(1);
};

const setupExport = async () => {
  const config = await getConfig(argv);
  await exportGtfs(config);
  process.exit();
};

setupExport().catch(handleError);
