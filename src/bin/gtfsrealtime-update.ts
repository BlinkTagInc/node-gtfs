#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import PrettyError from 'pretty-error';

import { getConfig } from '../lib/file-utils.ts';
import { formatError } from '../lib/log-utils.ts';
import { updateGtfsRealtime } from '../index.ts';
import type { Config } from '../types/global_interfaces.ts';
const pe = new PrettyError();

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

const handleError = (error = 'Unknown Error') => {
  process.stdout.write(`\n${formatError(error)}\n`);
  console.error(pe.render(error));
  process.exit(1);
};

const setupImport = async () => {
  const config = await getConfig({
    configPath: argv.configPath,
  });
  await updateGtfsRealtime(config as Config);
  process.exit();
};

setupImport().catch(handleError);
