const path = require('path');
const {promisify} = require('util');

const _ = require('lodash');
const csv = require('csv');
const extract = require('extract-zip');
const fetch = require('node-fetch');
const fs = require('fs-extra');
const MongoClient = require('mongodb').MongoClient;
const proj4 = require('proj4');
const untildify = require('untildify');

const extractAsync = promisify(extract);

const filenames = require('./filenames');
const utils = require('./utils');

const downloadFiles = task => {
  task.log(`Downloading GTFS from ${task.agency_url}`);

  task.path = `${task.downloadDir}/${task.agency_key}-gtfs.zip`;

  return fetch(task.agency_url)
  .then(res => {
    if (res.status !== 200) {
      throw new Error('Couldn\'t download files');
    }
    return res.buffer();
  })
  .then(buffer => fs.writeFile(task.path, buffer))
  .then(() => {
    task.log('Download successful');
  });
};

const readFiles = task => {
  const gtfsPath = untildify(task.path);
  task.log(`Importing GTFS from ${task.path}\r`);
  if (path.extname(gtfsPath) === '.zip') {
    return extractAsync(gtfsPath, {dir: task.downloadDir});
  }

  // Local file is unzipped, just copy it from there.
  return fs.copy(gtfsPath, task.downloadDir);
};

const removeDatabase = async task => {
  // Remove old db records based on agency_key
  for (const filename of filenames) {
    const collection = task.db.collection(filename.collection);
    await collection.remove({agency_key: task.agency_key});
  }
};

const importLines = (lines, collection, cb) => {
  const bulk = collection.initializeUnorderedBulkOp();
  const count = lines.length;

  while (lines.length) {
    bulk.insert(lines.pop());
  }
  bulk.execute(err => {
    cb(err, count);
  });
};

const formatLine = (line, task) => {
  // Remove null values and empty strings
  for (const key in line) {
    if (line[key] === null) {
      delete line[key];
    }

    line[key] = line[key].trim();
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
    'timetable_sequence'
  ];

  integerFields.forEach(fieldName => {
    if (line[fieldName]) {
      line[fieldName] = parseInt(line[fieldName], 10);
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
    }
  });

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
  for (const filename of filenames) {
    await new Promise((resolve, reject) => {
      // Filter out excluded files from config
      if (task.exclude && _.includes(task.exclude, filename.fileNameBase)) {
        task.log(`Skipping - ${filename.fileNameBase}.txt\r`);
        return resolve();
      }

      const filepath = path.join(task.downloadDir, `${filename.fileNameBase}.txt`);

      if (!fs.existsSync(filepath)) {
        if (!filename.nonstandard) {
          task.log(`Importing - ${filename.fileNameBase}.txt - No file found\r`);
        }
        return resolve();
      }

      task.log(`Importing - ${filename.fileNameBase}.txt\r`);

      const collection = task.db.collection(filename.collection);
      const lines = [];
      const chunkSize = 10000;
      let lineCount = 0;
      let line;
      const parser = csv.parse({
        columns: true,
        relax: true
      });

      parser.on('readable', () => {
        while (line = parser.read()) {
          line = formatLine(line, task);

          // Calculate agency bounds
          if (line.loc) {
            task.agency_bounds = utils.extendBounds(task.agency_bounds, line.loc);
          }

          lines.push(line);

          // If we have a bunch of lines ready to insert, then do it
          if (lines.length >= chunkSize) {
            importLines(lines, collection, (err, count) => {
              if (err) {
                task.log(err);
              }

              lineCount += count;
              task.log(`Importing - ${filename.fileNameBase}.txt - ${lineCount} lines imported\r`, true);
            });
          }
        }
      });

      parser.on('end', () => {
        // Insert all remaining lines
        if (lines.length > 0) {
          importLines(lines, collection, (err, count) => {
            if (err) {
              task.log(err);
            }

            lineCount += count;
            task.log(`Importing - ${filename.fileNameBase}.txt - ${lineCount} lines imported\r`, true);
            resolve();
          });
        } else {
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

const postProcess = task => {
  task.log('Post Processing data');

  return task.db.collection('agencies')
  .update({
    agency_key: task.agency_key
  }, {
    $set: {
      agency_bounds: task.agency_bounds,
      agency_center: utils.boundsCenter(task.agency_bounds),
      date_last_updated: Date.now()
    }
  });
};

module.exports = async config => {
  const log = utils.log(config);

  const agencyCount = config.agencies.length;
  log(`Starting GTFS import for ${agencyCount} ${utils.pluralize('file', agencyCount)}`);

  const mongoOptions = {
    w: 1,
    connectTimeoutMS: 120000,
    socketTimeoutMS: 120000
  };

  const db = await MongoClient.connect(config.mongoUrl, mongoOptions);

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
      db,
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
      await removeDatabase(task);
    }

    await importFiles(task);
    await postProcess(task);

    await fs.remove(task.downloadDir);
    task.log('Completed GTFS import');
  }

  log(`Completed GTFS import for ${agencyCount} ${utils.pluralize('file', agencyCount)}\n`);
  db.close();
};
