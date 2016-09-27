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
const argv = require('yargs').argv;

const filenames = require('../lib/filenames');

let q;
let config = {};
// check if this file was invoked direct through command line or required as an export
const invocation = (require.main === module) ? 'direct' : 'required';

if (invocation === 'direct') {
  try {
    config = require('../config.js');
  } catch(e) {
    try {
      config = require('../config-sample.js');
    } catch(e) {
      handleError(new Error('Cannot find config.js'));
    }
  }

  if (!config.agencies) {
    handleError(new Error('No agency_key specified in config.js\nTry adding \'capital-metro\' to the agencies in config.js to load transit data'));
    process.exit();
  }
}


function main(config, callback) {
  const log = (config.verbose === false) ? function() {} : console.log;

  // open database and create queue for agency list
  MongoClient.connect(config.mongo_url, {
    w: 1
  }, function(err, db) {
    if (err) handleError(err);

    q = async.queue(downloadGTFS, 1);
    // loop through all agencies specified
    config.agencies.forEach(function(item) {
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
        handleError(new Error('No URL or Agency Key or path provided.'));
      }

      q.push(agency);
    });

    q.drain = (err) => {
      if (err) handleError(err);

      log(`All agencies completed (${config.agencies.length} total)`);
      callback();
    };


    function downloadGTFS(task, cb) {
      const downloadDir = 'downloads';
      let gtfsDir = 'downloads';
      const agency_key = task.agency_key;
      const exclude = task.exclude;
      const agency_bounds = {
        sw: [],
        ne: []
      };

      log(`${agency_key}: Starting`);

      async.series([
        cleanupFiles,
        getFiles,
        removeDatabase,
        importFiles,
        postProcess,
        cleanupFiles
      ], (err) => {
        log(err || `${agency_key}: Completed`);
        cb();
      });


      function cleanupFiles(cb) {
        // remove old downloaded file
        rimraf(downloadDir, (err) => {
          if (err) {
            return handleError(err);
          }

          mkdirp(downloadDir, cb);
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
        // do download
        const file_protocol = require('url').parse(task.agency_url).protocol;
        if (file_protocol === 'http:' || file_protocol === 'https:') {
          log(`${agency_key}: Downloading`);
          request(task.agency_url, processFile).pipe(fs.createWriteStream(`${downloadDir}/latest.zip`));

          function processFile(err, response) {
            if (response && response.statusCode != 200) {
              cb(new Error('Couldn\'t download files'));
            }
            log(`${agency_key}: Download successful`);

            fs.createReadStream(`${downloadDir}/latest.zip`)
              .pipe(unzip.Extract({
                path: downloadDir
              }).on('close', cb))
              .on('error', function(err) {
                log(`${agency_key}: Error Unzipping File`);
                handleError(err);
              });
          }
        } else {
          if (!fs.existsSync(task.agency_url)) {
            return cb(new Error('File does not exists'));
          }

          fs.createReadStream(task.agency_url)
            .pipe(fs.createWriteStream(`${downloadDir}/latest.zip`))
            .on('close', () => {
              fs.createReadStream(`${downloadDir}/latest.zip`)
                .pipe(unzip.Extract({
                  path: downloadDir
                }).on('close', cb))
                .on('error', handleError);
            })
            .on('error', handleError);
        }
      }


      function readFiles(cb) {
        if (path.extname(task.path) === '.zip') {
          // local file is zipped
          fs.createReadStream(task.path)
            .pipe(unzip.Extract({
              path: downloadDir
            }).on('close', cb))
            .on('error', handleError);
        } else {
          // local file is unzipped, just read it from there.
          gtfsDir = task.path;
          cb();
        }
      }


      function removeDatabase(cb) {
        // remove old db records based on agency_key
        // can be overridden using the --skip-delete command line argument
        if (argv['skip-delete']) {
          log(`${agency_key}: Skipping deletion of existing data`);
          return cb();
        }

        async.forEach(filenames, function(filename, cb) {
          db.collection(filename.collection, function(e, collection) {
            collection.remove({
              agency_key
            }, cb);
          });
        }, cb);
      }


      function importFiles(cb) {
        // Loop through each file and add agency_key
        async.forEachSeries(filenames, (filename, cb) => {
          // filter out excluded files from config
          if (exclude && _.includes(exclude, filename.fileNameBase)) {
            log(`${agency_key}: Importing data - Skipping ${filename.fileNameBase}.txt`);
            return cb();
          }

          var filepath = path.join(gtfsDir, `${filename.fileNameBase}.txt`);

          if (!fs.existsSync(filepath)) {
            if (!filename.nonstandard) {
              log(`${agency_key}: Importing data - No ${filename.fileNameBase}.txt file found`);
            }

            return cb();
          }

          log(`${agency_key}: Importing data - ${filename.fileNameBase}.txt`);
          db.collection(filename.collection, (err, collection) => {
            if (err) return handleError(err);
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
                line.agency_key = agency_key;

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
                  if (agency_bounds.sw[0] > line.loc[0] || !agency_bounds.sw[0]) {
                    agency_bounds.sw[0] = line.loc[0];
                  }
                  if (agency_bounds.ne[0] < line.loc[0] || !agency_bounds.ne[0]) {
                    agency_bounds.ne[0] = line.loc[0];
                  }
                  if (agency_bounds.sw[1] > line.loc[1] || !agency_bounds.sw[1]) {
                    agency_bounds.sw[1] = line.loc[1];
                  }
                  if (agency_bounds.ne[1] < line.loc[1] || !agency_bounds.ne[1]) {
                    agency_bounds.ne[1] = line.loc[1];
                  }
                }

                //make lat/long for shapes
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
                collection.insertMany(chunk, function(err) {
                  if (err) {
                    log(`ERROR during mongo insertMany chunk ${filename.fileNameBase}`);
                    handleError(err);
                    return cb(err);
                  }
                  cb();
                });
              }, 1);

              queue.drain = () => {
                cb();
              };

              queue.push(chunks, (err) => {
                if (err) {
                  log(`ERROR SINGLE CALLBACK item processing ${filename.fileNameBase}`);
                } else {
                  // Ignore we don't want to fill the screen with unnecessary information
                }
              });
            });
            parser.on('error', handleError);
            input.pipe(parser);
          });
        }, cb);
      }


      function postProcess(cb) {
        log(`${agency_key}: Post Processing data`);

        async.series([
          agencyCenter,
          updatedDate
        ], () => {
          cb();
        });
      }


      function agencyCenter(cb) {
        const lat = (agency_bounds.ne[0] - agency_bounds.sw[0]) / 2 + agency_bounds.sw[0];
        const lon = (agency_bounds.ne[1] - agency_bounds.sw[1]) / 2 + agency_bounds.sw[1];
        const agency_center = [lat, lon];

        db.collection('agencies')
          .update({
            agency_key
          }, {
            $set: {
              agency_bounds,
              agency_center
            }
          }, cb);
      }


      function updatedDate(cb) {
        db.collection('agencies')
          .update({
            agency_key
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
  main(config, () => {
    process.exit();
  });
} else {
  module.exports = main;
}
