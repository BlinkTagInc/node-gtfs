#!/usr/bin/env node

const { argv } = require('yargs')
  .usage('Usage: $0 --configPath ./config.json')
  .help()
  .option('c', {
    alias: 'configPath',
    describe: 'Path to config file',
    type: 'string'
  })
  .option('gtfsPath', {
    describe: 'Path to gtfs (zipped or unzipped)',
    type: 'string'
  })
  .option('gtfsUrl', {
    describe: 'URL of gtfs file',
    type: 'string'
  })
  .option('sqlitePath', {
    describe: 'Path to SQLite database',
    type: 'string'
  });

const { getConfig } = require('../lib/file-utils');
const logUtils = require('../lib/log-utils');
const gtfs = require('..');

const handleError = error => {
  const text = error || 'Unknown Error';
  process.stdout.write(`\n${logUtils.formatError(text)}\n`);
  console.error(error);
  process.exit(1);
};

const setupImport = async () => {
  const config = await getConfig(argv);
  await gtfs.import(config);
  process.exit();
};

setupImport()
  .catch(handleError);
