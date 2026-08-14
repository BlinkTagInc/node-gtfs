#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { getConfig } from '../lib/file-utils.ts';
import { handleFatalError } from '../reporting/fatal.ts';
import { updateGtfsRealtime } from '../index.ts';
import type { Config } from '../types/global_interfaces.ts';

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 --configPath ./config.json')
  .help()
  .option('c', {
    alias: 'configPath',
    describe: 'Path to config file',
    type: 'string',
  })
  .default('configPath', undefined)
  .parseSync();

const setupImport = async () => {
  const config = await getConfig({
    configPath: argv.configPath,
  });
  await updateGtfsRealtime(config as Config);
  process.exit();
};

setupImport().catch(handleFatalError);
