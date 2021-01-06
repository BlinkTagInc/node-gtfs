#!/usr/bin/env node

const { argv } = require('yargs')
  .usage('Usage: $0 --config ./config.json')
  .help()
  .option('c', {
    alias: 'configPath',
    describe: 'Path to config file',
    default: './config.json',
    type: 'string'
  });

const fileUtils = require('../lib/file-utils');
const logUtils = require('../lib/log-utils');
const gtfs = require('..');

const handleError = (error = 'Unknown Error') => {
  process.stdout.write(`\n${logUtils.formatError(error)}\n`);
  process.exit(1);
};

const setupExport = async () => {
  const config = await fileUtils.getConfig(argv);
  await gtfs.export(config);
  process.exit();
};

setupExport()
  .catch(handleError);
