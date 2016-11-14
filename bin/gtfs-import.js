#!/usr/bin/env node

const gtfs = require('../');
const path = require('path');
const argv = require('yargs')
    .usage('Usage: $0 --config ./config.json')
    .help()
    .option('c', {
      alias: 'config-path',
      describe: 'Path to config file',
      default: './config.json',
      type: 'string'
    })
    .option('s', {
      alias: 'skip-delete',
      describe: 'Don\'t delete existing data for `agency_key` on import',
      type: 'boolean',
      default: false
    })
    .argv;

const configPath = path.join(process.cwd(), argv['config-path']);


function handleError(err) {
  console.error(err || 'Unknown Error');
  process.exit(1);
}


function getConfig() {
  try {
    const config = require(configPath);

    if (argv['skip-delete']) {
      config.skip_delete = argv['skip-delete'];
    }

    return config;
  } catch (err) {
    handleError(new Error(`Cannot find configuration file at \`${configPath}\`. Use config-sample.json as a starting point, pass --config-path option`));
  }
}


gtfs.import(getConfig(), (err) => {
  if (err) {
    handleError(err);
  }

  process.exit();
});
