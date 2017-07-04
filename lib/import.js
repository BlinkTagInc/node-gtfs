const path = require('path');

const _ = require('lodash');
const csv = require('csv');
const extract = require('extract-zip');
const fetch = require('node-fetch');
const fs = require('fs-extra');
const MongoClient = require('mongodb').MongoClient;
const proj4 = require('proj4');
const Promise = require('bluebird');
const filenames = require('./filenames');
const utils = require('./utils');

let log;

function cleanupFiles(task) {
  return fs.remove(task.downloadDir)
  .then(() => fs.ensureDir(task.downloadDir));
}

function downloadFiles(task) {
  log(`\n${task.agency_key}: Downloading GTFS from ${task.agency_url}`);

  const path = `${task.downloadDir}/${task.agency_key}-gtfs.zip`;

  return fetch(task.agency_url)
  .then(res => {
    if (res.status !== 200) {
      throw new Error('Couldn\'t download files');
    }

    log(`\n${task.agency_key}: Download successful`);

    return res.buffer();
  })
  .then(buffer => fs.writeFile(path, buffer))
  .then(() => path);
}

function readFiles(task) {
  log(`\n${task.agency_key}: Importing GTFS from ${task.path}\r`);

  if (path.extname(task.path) === '.zip') {
    return new Promise((resolve, reject) => {
      extract(task.path, {dir: task.downloadDir}, err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  // Local file is unzipped, just copy it from there.
  return fs.copy(task.path, task.downloadDir);
}

function removeDatabase(task) {
  // Remove old db records based on agency_key
  return Promise.all(filenames.map(filename => {
    const collection = task.db.collection(filename.collection);
    return collection.remove({agency_key: task.agency_key});
  }));
}

function importLines(lines, collection, cb) {
  const bulk = collection.initializeUnorderedBulkOp();
  const count = lines.length;

  while (lines.length) {
    bulk.insert(lines.pop());
  }
  bulk.execute(err => {
    cb(err, count);
  });
}

function formatLine(line, task) {
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
}

function importFiles(task) {
  let agencyBounds = {
    sw: [],
    ne: []
  };

  // Loop through each GTFS file
  return Promise.each(filenames, filename => {
    // Filter out excluded files from config
    if (task.exclude && _.includes(task.exclude, filename.fileNameBase)) {
      log(`\n${task.agency_key}: Skipping - ${filename.fileNameBase}.txt\r`);
      return false;
    }

    const filepath = path.join(task.downloadDir, `${filename.fileNameBase}.txt`);

    if (!fs.existsSync(filepath)) {
      if (!filename.nonstandard) {
        log(`\n${task.agency_key}: Importing - ${filename.fileNameBase}.txt - No file found\r`);
      }
      return false;
    }

    log(`\n${task.agency_key}: Importing - ${filename.fileNameBase}.txt\r`);

    return new Promise((resolve, reject) => {
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
            agencyBounds = utils.extendBounds(agencyBounds, line.loc);
          }

          lines.push(line);

          // If we have a bunch of lines ready to insert, then do it
          if (lines.length >= chunkSize) {
            importLines(lines, collection, (err, count) => {
              if (err) {
                log(err);
              }

              lineCount += count;
              log(`${task.agency_key}: Importing - ${filename.fileNameBase}.txt - ${lineCount} lines imported\r`);
            });
          }
        }
      });

      parser.on('end', () => {
        // Insert all remaining lines
        if (lines.length > 0) {
          importLines(lines, collection, (err, count) => {
            if (err) {
              log(err);
            }

            lineCount += count;
            log(`${task.agency_key}: Importing - ${filename.fileNameBase}.txt - ${lineCount} lines imported\r`);
            resolve();
          });
        } else {
          resolve();
        }
      });

      parser.on('error', reject);

      fs.createReadStream(filepath).pipe(parser);
    });
  })
  .then(() => agencyBounds);
}

function postProcess(task) {
  log(`\n${task.agency_key}: Post Processing data`);

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
}

module.exports = config => {
  log = (config.verbose === false) ? _.noop : text => process.stdout.write(text);

  const fileCount = config.agencies.length;
  log(`Starting GTFS import for ${fileCount} ${utils.pluralize('file', fileCount)}`);

  // Open database and create queue for agency list
  const mongoOptions = {
    w: 1,
    connectTimeoutMS: 120000,
    socketTimeoutMS: 120000
  };

  return MongoClient.connect(config.mongoUrl, mongoOptions)
  .then(db => {
    return Promise.each(config.agencies, item => {
      const task = _.pick(item, ['exclude', 'agency_key']);
      task.downloadDir = path.resolve('./downloads');
      task.db = db;
      task.skipDelete = config.skipDelete;

      if (item.url) {
        task.agency_url = item.url;
      } else if (item.path) {
        task.path = item.path;
      }

      if (!task.agency_key) {
        throw new Error('No Agency Key provided.');
      }

      if (!task.agency_url && !task.path) {
        throw new Error('No Agency URL or path provided.');
      }

      return cleanupFiles(task)
      .then(() => {
        if (task.agency_url) {
          return downloadFiles(task)
          .then(path => {
            task.path = path;
          });
        }
      })
      .then(() => readFiles(task))
      .then(() => {
        // Override using the --skipDelete command line argument or `skipDelete`
        // in config.json
        if (task.skipDelete) {
          log(`\n${task.agency_key}: Skipping deletion of existing data`);
          return;
        }
        return removeDatabase(task);
      })
      .then(() => {
        return importFiles(task)
        .then(agencyBounds => {
          task.agency_bounds = agencyBounds;
        });
      })
      .then(() => postProcess(task))
      .then(() => cleanupFiles(task))
      .then(() => {
        log(`\n${task.agency_key}: Completed`);
      });
    })
    .then(() => {
      log(`\nCompleted GTFS import for ${fileCount} ${utils.pluralize('file', fileCount)}\n`);
      db.close();
    });
  });
};
