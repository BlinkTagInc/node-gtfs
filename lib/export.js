/* eslint-disable no-use-extend-native/no-use-extend-native */

const path = require('path');

const _ = require('lodash');
const fs = require('fs-extra');
const sanitize = require('sanitize-filename');
const stringify = require('csv-stringify/lib/sync');
const Promise = require('bluebird');

const models = require('../models/models');
const fileUtils = require('./file-utils');
const logUtils = require('./log-utils');
const utils = require('./utils');

const exportFiles = task => {
  // Loop through each GTFS file
  return Promise.mapSeries(models, async model => {
    // Filter out excluded files from config
    if (task.exclude && _.includes(task.exclude, model.filenameBase)) {
      task.log(`Skipping - ${model.filenameBase}.txt\r`);
      return;
    }

    const filepath = path.join(task.export_path, `${model.filenameBase}.txt`);

    const lines = await model.model.find({
      agency_key: task.agency_key
    },
    utils.defaultProjection,
    {
      lean: true,
      timeout: true
    });

    if (!lines || lines.length === 0) {
      task.log(`Skipping (no data) - ${model.filenameBase}.txt\r`);
      return;
    }

    const excludeColumns = [
      '_id',
      '__v',
      'created_at',
      'agency_key',
      'loc',
      'agency_bounds.sw',
      'agency_bounds.ne',
      'agency_center',
      'arrival_timestamp',
      'departure_timestamp',
      'start_timestamp',
      'end_timestamp'
    ];

    const columns = _.without(Object.keys(model.model.schema.paths), ...excludeColumns);

    const fileText = stringify(lines, { columns, header: true });
    await fs.writeFile(filepath, fileText);

    task.log(`Exporting - ${model.filenameBase}.txt\r`);

    return `${model.filenameBase}.txt`;
  });
};

module.exports = async config => {
  const log = logUtils.log(config);
  const logError = logUtils.logError(config);

  const agencyCount = config.agencies.length;
  log(`Starting GTFS export for ${agencyCount} ${utils.pluralize('file', agencyCount)}`);

  await Promise.mapSeries(config.agencies, async agency => {
    if (!agency.agency_key) {
      throw new Error('No Agency Key provided.');
    }

    const exportPath = path.join(process.cwd(), 'gtfs-export', sanitize(agency.agency_key));

    const task = {
      exclude: agency.exclude,
      agency_key: agency.agency_key,
      export_path: exportPath,
      log: (message, overwrite) => {
        log(`${task.agency_key}: ${message}`, overwrite);
      },
      error: message => {
        logError(message);
      },
      created_at: new Date()
    };

    await fileUtils.prepDirectory(exportPath);
    const exportedFiles = await exportFiles(task);

    if (_.compact(exportedFiles).length === 0) {
      task.log(`${task.agency_key}: No data found for agency_key=${task.agency_key}. Check config.json.`);
      return;
    }

    task.log(`${task.agency_key}: Completed GTFS export to ${exportPath}`);
  });

  log(`Completed GTFS export for ${agencyCount} ${utils.pluralize('file', agencyCount)}\n`);
};
