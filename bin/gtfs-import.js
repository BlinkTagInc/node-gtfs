#!/usr/bin/env node

const mongoose = require('mongoose');
const { argv } = require('yargs')
  .usage('Usage: $0 --config ./config.json')
  .help()
  .option('c', {
    alias: 'configPath',
    describe: 'Path to config file',
    default: './config.json',
    type: 'string'
  })
  .option('s', {
    alias: 'skipDelete',
    describe: 'Don’t delete existing data for `agency_key` on import',
    type: 'boolean',
    default: false
  });

const fileUtils = require('../lib/file-utils');
const logUtils = require('../lib/log-utils');
const gtfs = require('..');

const handleError = err => {
  const text = err || 'Unknown Error';
  process.stdout.write(`\n${logUtils.formatError(text)}\n`);
  process.exit(1);
};

const setupImport = async () => {
  const config = await fileUtils.getConfig(argv);

  await mongoose.connect(config.mongoUrl, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
  await gtfs.import(config);
  await mongoose.connection.close();
  process.exit();
};

setupImport()
  .catch(handleError);
