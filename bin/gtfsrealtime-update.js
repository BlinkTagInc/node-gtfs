#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import PrettyError from 'pretty-error';

import { getConfig } from '../lib/file-utils.js';
import { formatError } from '../lib/log-utils.js';
import { updateGtfsRealtime } from '../lib/gtfs.js';

const pe = new PrettyError();

const { argv } = yargs(hideBin(process.argv))
  .usage('Usage: $0 --configPath ./config.json')
  .help()
  .option('c', {
    alias: 'configPath',
    describe: 'Path to config file',
    type: 'string',
  });

const handleError = (error) => {
  const text = error || 'Unknown Error';
  process.stdout.write(`\n${formatError(text)}\n`);
  console.error(pe.render(error));
  process.exit(1);
};

const setupImport = async () => {
  const config = await getConfig(argv);
  await updateGtfsRealtime(config);
  process.exit();
};

setupImport().catch(handleError);
