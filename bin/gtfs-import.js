#!/usr/bin/env node

const path = require('path');

const fs = require('fs-extra');
const mongoose = require('mongoose');
const untildify = require('untildify');
const {argv} = require('yargs')
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
    describe: 'Don\'t delete existing data for `agency_key` on import',
    type: 'boolean',
    default: false
  });

const logUtils = require('../lib/log-utils');
const gtfs = require('..');

const handleError = err => {
  logUtils.error(err || 'Unknown Error');
  process.exit(1);
};

const getConfig = async () => {
  const data = await fs.readFile(path.resolve(untildify(argv.configPath)), 'utf8');
  const config = JSON.parse(data);

  if (argv.skipDelete) {
    config.skipDelete = argv.skipDelete;
  }

  return config;
};

const setupImport = async () => {
  let config;
  try {
    config = await getConfig();
  } catch (err) {
    console.error(new Error(`Cannot find configuration file at \`${argv.configPath}\`. Use config-sample.json as a starting point, pass --configPath option`));
    handleError(err);
  }

  await mongoose.connect(config.mongoUrl);
  await gtfs.import(config);
  await mongoose.connection.close();
  process.exit();
};

setupImport()
  .catch(handleError);
