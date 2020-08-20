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

const handleError = err => {
  const text = err || 'Unknown Error';
  process.stdout.write(`\n${logUtils.formatError(text)}\n`);
  console.error(err);
  process.exit(1);
};

const setupImport = async () => {
  const config = await fileUtils.getConfig(argv);
  await gtfs.import(config);
  process.exit();
};

setupImport()
  .catch(handleError);
