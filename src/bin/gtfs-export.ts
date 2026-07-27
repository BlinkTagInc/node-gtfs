#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { getConfig } from '../lib/file-utils.ts';
import { formatError, formatStackTrace } from '../lib/log-utils.ts';
import { exportGtfs } from '../index.ts';
import type { Config } from '../types/global_interfaces.ts';

const argv = yargs(hideBin(process.argv))
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
  .parseSync();

const handleError = (error: Error | string = 'Unknown Error') => {
  process.stdout.write(`\n${formatError(error)}\n`);
  console.error(formatStackTrace(error));
  process.exit(1);
};

const setupExport = async () => {
  const config = await getConfig(argv);
  await exportGtfs(config as Config);
  process.exit();
};

setupExport().catch(handleError);
