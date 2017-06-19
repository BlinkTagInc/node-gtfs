#!/usr/bin/env node

const path = require('path');

const fs = require('fs-extra');
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

function handleError(err) {
  console.error(err || 'Unknown Error');
  process.exit(1);
}

fs.readFile(path.resolve(untildify(argv.configPath)), 'utf8')
.then(data => JSON.parse(data))
.then(config => {
  if (argv.skipDelete) {
    config.skipDelete = argv.skipDelete;
  }
  return config;
})
.catch(err => {
  console.error(new Error(`Cannot find configuration file at \`${argv.configPath}\`. Use config-sample.json as a starting point, pass --configPath option`));
  handleError(err);
})
.then(gtfs.import)
.then(() => {
  process.exit();
})
.catch(handleError);
