#!/usr/bin/env node
const path = require('path');
const untildify = require('untildify');
const argv = require('yargs')
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
    })
    .argv;

const gtfs = require('../');

const configPath = path.resolve(untildify(argv.configPath));

function handleError(err) {
  console.error(err || 'Unknown Error');
  process.exit(1);
}

function getConfig() {
  try {
    const config = require(configPath);

    if (argv.skipDelete) {
      config.skipDelete = argv.skipDelete;
    }

    return config;
  } catch (err) {
    handleError(new Error('Cannot find configuration file at \`${configPath}\`. Use config-sample.json as a starting point, pass --configPath option'));
  }
}

gtfs.import(getConfig(), err => {
  if (err) {
    handleError(err);
  }

  process.exit();
});
