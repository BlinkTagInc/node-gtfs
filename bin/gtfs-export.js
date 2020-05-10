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
  });

const fileUtils = require('../lib/file-utils');
const logUtils = require('../lib/log-utils');
const gtfs = require('..');

const handleError = err => {
  const text = err || 'Unknown Error';
  process.stdout.write(`\n${logUtils.formatError(text)}\n`);
  process.exit(1);
};

const setupExport = async () => {
  const config = await fileUtils.getConfig(argv);

  await mongoose.connect(config.mongoUrl, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
  await gtfs.export(config);
  await mongoose.connection.close();
  process.exit();
};

setupExport()
  .catch(handleError);
