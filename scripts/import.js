const async = require('async');
const _ = require('lodash');
const csv = require('csv');
const fs = require('fs');
const mkdirp = require('mkdirp');
const MongoClient = require('mongodb').MongoClient;
const path = require('path');
const proj4 = require('proj4');
const request = require('request');
const rimraf = require('rimraf');
const unzip = require('unzip2');
const url = require('url');
const argv = require('yargs').argv;

const filenames = require('../lib/filenames');
const utils = require('../lib/utils');

// Check if this file was invoked direct through command line or required as an export
const invocation = (require.main === module) ? 'direct' : 'required';

function main(config, cb) {
  const log = (config.verbose === false) ? function() {} : console.log;

  // Open database and create queue for agency list
  MongoClient.connect(config.mongo_url, { w: 1 }, (err, db) => {
    if (err) return cb(err);

    const q = async.queue(importGTFS, 1);
    // loop through all agencies specified
    config.agencies.forEach((item) => {
      const agency = {
        exclude: item.exclude
      };

      if (item.url) {
        agency.agency_key = item.agency_key;
        agency.agency_url = item.url;
      } else if (item.path) {
        agency.agency_key = item.agency_key;
        agency.path = item.path;
      }

      if (!agency.agency_key) {
        return cb(new Error('No Agency Key provided.'));
      }

      if (!agency.agency_url && !agency.path) {
        return cb(new Error('No Agency URL or path provided.'));
      }

      q.push(agency, (err) => {
        if(err) {
          q.kill();
          cb(err);
        }
      });
    });

    q.drain = () => {
      log(`All agencies completed (${config.agencies.length} total)`);
      cb();
    };


    function importGTFS(task, cb) {
      task.downloadDir = 'downloads';
      task.gtfsDir = 'downloads';
      task.agency_bounds = {
        sw: [],
        ne: []
      };

      log(`${task.agency_key}: Starting`);

      async.series([
        cleanupFiles,
        getFiles,
        removeDatabase,
        importFiles,
        postProcess,
        cleanupFiles
      ], (err) => {
        if (err) return cb(err);

        log(`${task.agency_key}: Completed`);
        cb();
      });


      function cleanupFiles(cb) {
        // Remove old downloaded file
        rimraf(task.downloadDir, (err) => {
          if (err) return cb(err);

          mkdirp(task.downloadDir, cb);
        });
      }


      function getFiles(cb) {
        if (task.agency_url) {
          downloadFiles(cb);
        } else if (task.path) {
          readFiles(cb);
        }
      }


      function downloadFiles(cb) {
        // Do download
        log(`${task.agency_key}: Downloading`);
        request(task.agency_url, (err, response) => {
          if (err) return cb(err);

          if (response && response.statusCode != 200) {
            return cb(new Error('Couldn\'t download files'));
          }

          log(`${task.agency_key}: Download successful`);

          fs.createReadStream(`${task.downloadDir}/latest.zip`)
            .pipe(unzip.Extract({
              path: task.downloadDir
            }).on('close', cb))
            .on('error', (err) => {
              log(`${task.agency_key}: Error Unzipping File`);
              cb(err);
            });
        }).pipe(fs.createWriteStream(`${task.downloadDir}/latest.zip`));
      }

      function readFiles(cb) {
        if (path.extname(task.path) === '.zip') {
          // local file is zipped
          fs.createReadStream(task.path)
            .pipe(unzip.Extract({
              path: task.downloadDir
            }).on('close', cb))
            .on('error', cb);
        } else {
          // Local file is unzipped, just read it from there.
          task.gtfsDir = task.path;
          cb();
        }
      }


      function removeDatabase(cb) {
        // remove old db records based on agency_key
        // can be overridden using the --skip-delete command line argument
        if (argv['skip-delete']) {
          log(`${task.agency_key}: Skipping deletion of existing data`);
          return cb();
        }

        async.forEach(filenames, (filename, cb) => {
          db.collection(filename.collection, (err, collection) => {
            if (err) return cb(err);
            collection.remove({
              agency_key: task.agency_key
            }, cb);
          });
        }, cb);
      }


      function importFiles(cb) {
        // Loop through each file and add agency_key
        async.forEachSeries(filenames, (filename, cb) => {
          // filter out excluded files from config
          if (task.exclude && _.includes(task.exclude, filename.fileNameBase)) {
            log(`${task.agency_key}: Importing data - Skipping ${filename.fileNameBase}.txt`);
            return cb();
          }

          var filepath = path.join(task.gtfsDir, `${filename.fileNameBase}.txt`);

          if (!fs.existsSync(filepath)) {
            if (!filename.nonstandard) {
              log(`${task.agency_key}: Importing data - No ${filename.fileNameBase}.txt file found`);
            }

            return cb();
          }

          log(`${task.agency_key}: Importing data - ${filename.fileNameBase}.txt`);
          db.collection(filename.collection, (err, collection) => {
            if (err) return cb(err);

            const input = fs.createReadStream(filepath);

            const parser = csv.parse({
              columns: true,
              relax: true
            });

            const lines = [];

            parser.on('readable', () => {
              while(line = parser.read()) {
                // Remove null values
                for(const key in line) {
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
                  'timetable_sequence'
                ];

                integerFields.forEach((fieldName) => {
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

                floatFields.forEach((fieldName) => {
                  if (line[fieldName]) {
                    line[fieldName] = parseFloat(line[fieldName]);
                  }
                });

                // make lat/lon array for stops
                if (line.stop_lat && line.stop_lon) {
                  line.loc = [
                    line.stop_lon,
                    line.stop_lat
                  ];

                  // if coordinates are not specified, use [0,0]
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

                  // Calulate agency bounds
                  if (task.agency_bounds.sw[0] > line.loc[0] || !task.agency_bounds.sw[0]) {
                    task.agency_bounds.sw[0] = line.loc[0];
                  }
                  if (task.agency_bounds.ne[0] < line.loc[0] || !task.agency_bounds.ne[0]) {
                    task.agency_bounds.ne[0] = line.loc[0];
                  }
                  if (task.agency_bounds.sw[1] > line.loc[1] || !task.agency_bounds.sw[1]) {
                    task.agency_bounds.sw[1] = line.loc[1];
                  }
                  if (task.agency_bounds.ne[1] < line.loc[1] || !task.agency_bounds.ne[1]) {
                    task.agency_bounds.ne[1] = line.loc[1];
                  }
                }

                // Make lat/long for shapes
                if (line.shape_pt_lat && line.shape_pt_lon) {
                  line.loc = [line.shape_pt_lon, line.shape_pt_lat];
                }
                lines.push(line);
              }
            });

            parser.on('end', () => {
              const chunkSize = 10000;
              const chunks = _.chunk(lines, chunkSize);

              // Only insert 1 chunk at once in order to avoid an out-of-memory error
              const queue = async.queue((chunk, cb) => {
                collection.insertMany(chunk, cb);
              }, 1);

              queue.drain = cb;

              queue.push(chunks, (err) => {
                if (err) {
                  log(`ERROR SINGLE CALLBACK item processing ${filename.fileNameBase}`);
                }
              });
            });
            parser.on('error', cb);
            input.pipe(parser);
          });
        }, cb);
      }


      function postProcess(cb) {
        log(`${task.agency_key}: Post Processing data`);

        async.series([
          agencyCenter,
          updatedDate
        ], cb);
      }


      function agencyCenter(cb) {
        const lat = (task.agency_bounds.ne[0] - task.agency_bounds.sw[0]) / 2 + task.agency_bounds.sw[0];
        const lon = (task.agency_bounds.ne[1] - task.agency_bounds.sw[1]) / 2 + task.agency_bounds.sw[1];
        const agency_center = [lat, lon];

        db.collection('agencies')
          .update({
            agency_key: task.agency_key
          }, {
            $set: {
              agency_bounds: task.agency_bounds,
              agency_center
            }
          }, cb);
      }


      function updatedDate(cb) {
        db.collection('agencies')
          .update({
            agency_key: task.agency_key
          }, {
            $set: {
              date_last_updated: Date.now()
            }
          }, cb);
      }
    }
  });
}

function handleError(err) {
  console.error(err || 'Unknown Error');
  process.exit(1);
}

// Allow script to be called directly from commandline or required (for testable code)
if (invocation === 'direct') {
  const config = utils.loadConfig();

  main(config, (err) => {
    if (err) return handleError(err);

    process.exit();
  });
} else {
  module.exports = main;
}
