#!/usr/bin/env node

const { argv } = require('yargs')
  .usage('Usage: $0 --configPath ./config.json')
  .help()
  .option('c', {
    alias: 'configPath',
    describe: 'Path to config file',
    type: 'string'
  })
  .option('sqlitePath', {
    describe: 'Path to SQLite database',
    type: 'string'
  })
  .option('exportPath', {
    describe: 'Path where GTFS export should go',
    type: 'string'
  });

const { getConfig } = require('../lib/file-utils');
const logUtils = require('../lib/log-utils');
const gtfs = require('..');

const handleError = (error = 'Unknown Error') => {
  process.stdout.write(`\n${logUtils.formatError(error)}\n`);
  process.exit(1);
};

const setupExport = async () => {
  const config = await getConfig(argv);
  await gtfs.export(config);
  process.exit();
};

setupExport()
  .catch(handleError);
