const path = require('path');
const {promisify} = require('util');

const _ = require('lodash');
const extract = require('extract-zip');
const fetch = require('node-fetch');
const fs = require('fs-extra');
const parse = require('csv-parse');
const proj4 = require('proj4');
const untildify = require('untildify');

const extractAsync = promisify(extract);

const models = require('../models/models');
const logUtils = require('./log-utils');
const utils = require('./utils');

const downloadFiles = async task => {
  task.log(`Downloading GTFS from ${task.agency_url}`);

  task.path = `${task.downloadDir}/${task.agency_key}-gtfs.zip`;

  const res = await fetch(task.agency_url);

  if (res.status !== 200) {
    throw new Error('Couldn\'t download files');
  }

  const buffer = await res.buffer();

  await fs.writeFile(task.path, buffer);
  task.log('Download successful');
};

const readFiles = async task => {
  const gtfsPath = untildify(task.path);
  task.log(`Importing GTFS from ${task.path}\r`);
  if (path.extname(gtfsPath) === '.zip') {
    try {
      await extractAsync(gtfsPath, {dir: task.downloadDir});
    } catch (err) {
      logUtils.error(err);
      throw new Error(`Unable to unzip file ${task.path}`);
    }

    const files = await fs.readdir(task.downloadDir);
    const textFiles = files.filter(file => file.slice(-3) === 'txt');

    if (textFiles.length === 0) {
      throw new Error(`No .txt files found in ${task.path}. Ensure that .txt files are in the top level of the zip file, not in a subdirectory.`);
    }
  } else {
    // Local file is unzipped, just copy it from there.
    await fs.copy(gtfsPath, task.downloadDir);
  }
};

const removeData = task => {
  // Remove old db records based on agency_key
  return Promise.all(models.map(model => {
    return model.model.collection.remove({agency_key: task.agency_key});
  }));
};

const importLines = (lines, model, cb) => {
  const bulk = model.collection.initializeUnorderedBulkOp();
  const count = lines.length;

  if (!bulk) {
    return cb(new Error('Unable to initialize Mongo bulk insert.'));
  }

  while (lines.length) {
    bulk.insert(lines.pop());
  }
  bulk.execute(err => {
    cb(err, count);
  });
};

const formatLine = async (line, task, lineNumber) => {
  // Remove null values
  for (const key in line) {
    if (line[key] === null) {
      delete line[key];
    }
  }

  // Add agency_key
  line.agency_key = task.agency_key;

  // Convert fields that should be int
  const integerFields = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
    'start_date',
    'end_date',
    'date',
    'exception_type',
    'shape_pt_sequence',
    'payment_method',
    'transfers',
    'transfer_duration',
    'feed_start_date',
    'feed_end_date',
    'headway_secs',
    'exact_times',
    'route_type',
    'direction_id',
    'location_type',
    'wheelchair_boarding',
    'stop_sequence',
    'pickup_type',
    'drop_off_type',
    'use_stop_sequence',
    'transfer_type',
    'min_transfer_time',
    'wheelchair_accessible',
    'bikes_allowed',
    'timepoint',
    'timetable_sequence',
    'include_exceptions',
    'show_continues_as'
  ];

  integerFields.forEach(fieldName => {
    if (line[fieldName]) {
      line[fieldName] = parseInt(line[fieldName], 10);
    } else {
      delete line[fieldName];
    }
  });

  // Convert fields that should be float
  const floatFields = [
    'price',
    'shape_dist_traveled',
    'shape_pt_lat',
    'shape_pt_lon',
    'stop_lat',
    'stop_lon'
  ];

  floatFields.forEach(fieldName => {
    if (line[fieldName]) {
      line[fieldName] = parseFloat(line[fieldName]);
    } else {
      delete line[fieldName];
    }
  });

  // Check for valid coordinates
  const latitudeFields = [
    'shape_pt_lat',
    'stop_lat'
  ];

  for (const fieldName of latitudeFields) {
    if (line[fieldName] !== undefined) {
      if (line[fieldName] < -90 || line[fieldName] > 90) {
        throw new Error(`Invalid latitude in ${fieldName} on ${lineNumber}`);
      }
    }
  }

  const longitudeFields = [
    'shape_pt_lon',
    'stop_lon'
  ];

  for (const fieldName of longitudeFields) {
    if (line[fieldName] !== undefined) {
      if (line[fieldName] < -180 || line[fieldName] > 180) {
        throw new Error(`Invalid longitude in ${fieldName} on ${lineNumber}`);
      }
    }
  }

  // Make lat/lon array for stops
  if (line.stop_lat && line.stop_lon) {
    line.loc = [
      line.stop_lon,
      line.stop_lat
    ];

    // If coordinates are not specified, use [0,0]
    if (isNaN(line.loc[0])) {
      line.loc[0] = 0;
    }
    if (isNaN(line.loc[1])) {
      line.loc[1] = 0;
    }

    // Convert to epsg4326 if needed
    if (task.agency_proj) {
      line.loc = proj4(task.agency_proj, 'WGS84', line.loc);
      line.stop_lon = line.loc[0];
      line.stop_lat = line.loc[1];
    }
  }

  // Make lat/long for shapes
  if (line.shape_pt_lat && line.shape_pt_lon) {
    line.loc = [line.shape_pt_lon, line.shape_pt_lat];
  }

  return line;
};

const importFiles = async task => {
  task.agency_bounds = {
    sw: [],
    ne: []
  };

  // Loop through each GTFS file
  for (const model of models) {
    await new Promise((resolve, reject) => {
      // Filter out excluded files from config
      if (task.exclude && _.includes(task.exclude, model.filenameBase)) {
        task.log(`Skipping - ${model.filenameBase}.txt\r`);
        return resolve();
      }

      const filepath = path.join(task.downloadDir, `${model.filenameBase}.txt`);

      if (!fs.existsSync(filepath)) {
        if (!model.nonstandard) {
          task.log(`Importing - ${model.filenameBase}.txt - No file found\r`);
        }
        return resolve();
      }

      task.log(`Importing - ${model.filenameBase}.txt\r`);

      const lines = [];
      const chunkSize = 10000;
      let lineCount = 0;
      let line;
      const parser = parse({
        columns: true,
        relax: true,
        trim: true
      });

      parser.on('readable', async () => {
        let record;
        while (record = parser.read()) {
          const line = await formatLine(record, task, parser.lines).catch(reject);

          // Calculate agency bounds
          if (line.loc) {
            task.agency_bounds = utils.extendBounds(task.agency_bounds, line.loc);
          }

          lines.push(line);

          // If we have a bunch of lines ready to insert, then do it
          if (lines.length >= chunkSize) {
            importLines(lines, model.model, (err, count) => {
              if (err) {
                return reject(err);
              }

              lineCount += count;
              task.log(`Importing - ${model.filenameBase}.txt - ${lineCount} lines imported\r`, true);
            });
          }
        }
      });

      parser.on('end', () => {
        // Insert all remaining lines
        if (lines.length > 0) {
          importLines(lines, model.model, (err, count) => {
            if (err) {
              return reject(err);
            }

            lineCount += count;
            task.log(`Importing - ${model.filenameBase}.txt - ${lineCount} lines imported\r`, true);
            resolve();
          });
        } else {
          task.log(`Importing - ${model.filenameBase}.txt - ${lineCount} lines imported\r`, true);
          resolve();
        }
      });

      parser.on('error', reject);

      fs.createReadStream(filepath).pipe(parser);
    })
      .catch(err => {
        throw err;
      });
  }
};

const postProcess = async task => {
  task.log('Post Processing data');

  const agencyModel = _.find(models, {filenameBase: 'agency'});
  const agencyCenter = utils.boundsCenter(task.agency_bounds);

  await agencyModel.model.collection.update({
    agency_key: task.agency_key
  }, {
    $set: {
      agency_bounds: task.agency_bounds,
      agency_center: agencyCenter,
      date_last_updated: Date.now()
    }
  });
};

const ensureIndexes = () => {
  return Promise.all(models.map(model => model.model.ensureIndexes()));
};

module.exports = async config => {
  const log = logUtils.log(config);

  const agencyCount = config.agencies.length;
  log(`Starting GTFS import for ${agencyCount} ${utils.pluralize('file', agencyCount)}`);

  for (const agency of config.agencies) {
    if (!agency.agency_key) {
      throw new Error('No Agency Key provided.');
    }

    if (!agency.url && !agency.path) {
      throw new Error('No Agency URL or path provided.');
    }

    const task = {
      exclude: agency.exclude,
      agency_key: agency.agency_key,
      agency_url: agency.url,
      path: agency.path,
      downloadDir: path.resolve('./gtfs-downloads'),
      skipDelete: config.skipDelete,
      log: (message, overwrite) => {
        log(`${task.agency_key}: ${message}`, overwrite);
      }
    };

    await fs.remove(task.downloadDir);
    await fs.ensureDir(task.downloadDir);

    if (task.agency_url) {
      await downloadFiles(task);
    }
    await readFiles(task);

    // Override using --skipDelete command line argument or `skipDelete` in config.json
    if (task.skipDelete === true) {
      task.log('Skipping deletion of existing data');
    } else {
      await removeData(task);
    }

    await importFiles(task);
    await postProcess(task);
    await ensureIndexes();

    await fs.remove(task.downloadDir);
    task.log('Completed GTFS import');
  }

  log(`Completed GTFS import for ${agencyCount} ${utils.pluralize('file', agencyCount)}\n`);
};
