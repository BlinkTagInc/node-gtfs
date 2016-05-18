var async = require('async');
var _ = require('lodash');
var csv = require('csv');
var fs = require('fs');
var mkdirp = require('mkdirp');
var MongoClient = require('mongodb').MongoClient;
var path = require('path');
var proj4 = require('proj4');
var request = require('request');
var rimraf = require('rimraf');
var unzip = require('unzip2');
var argv = require('yargs').argv;

var filenames = require('../lib/filenames');

var q;
var config = {};
// check if this file was invoked direct through command line or required as an export
var invocation = (require.main === module) ? 'direct' : 'required';

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
  var log = (config.verbose === false) ? function() {} : console.log;

  // open database and create queue for agency list
  MongoClient.connect(config.mongo_url, {
    w: 1
  }, function(e, db) {
    if (e) handleError(e);

    q = async.queue(downloadGTFS, 1);
    // loop through all agencies specified
    config.agencies.forEach(function(item) {
      var agency = {};

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

    q.drain = function(e) {
      if (e) handleError(e);

      log('All agencies completed (' + config.agencies.length + ' total)');
      callback();
    };


    function downloadGTFS(task, cb) {
      var downloadDir = 'downloads';
      var gtfsDir = 'downloads';
      var agency_key = task.agency_key;
      var agency_bounds = {
        sw: [],
        ne: []
      };

      log(agency_key + ': Starting');

      async.series([
        cleanupFiles,
        getFiles,
        removeDatabase,
        importFiles,
        postProcess,
        cleanupFiles
      ], function(e) {
        log(e || agency_key + ': Completed');
        cb();
      });


      function cleanupFiles(cb) {
        // remove old downloaded file
        rimraf(downloadDir, function(e) {
          if (e) {
            return handleError(e);
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
        var file_protocol = require('url').parse(task.agency_url).protocol;
        if (file_protocol === 'http:' || file_protocol === 'https:') {
          log(agency_key + ': Downloading');
          request(task.agency_url, processFile).pipe(fs.createWriteStream(downloadDir + '/latest.zip'));

          function processFile(e, response) {
            if (response && response.statusCode != 200) {
              cb(new Error('Couldn\'t download files'));
            }
            log(agency_key + ': Download successful');

            fs.createReadStream(downloadDir + '/latest.zip')
              .pipe(unzip.Extract({
                path: downloadDir
              }).on('close', cb))
              .on('error', function(e) {
                log(agency_key + ': Error Unzipping File');
                handleError(e);
              });
          }
        } else {
          if (!fs.existsSync(task.agency_url)) {
            return cb(new Error('File does not exists'));
          }

          fs.createReadStream(task.agency_url)
            .pipe(fs.createWriteStream(downloadDir + '/latest.zip'))
            .on('close', function() {
              fs.createReadStream(downloadDir + '/latest.zip')
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
          log(agency_key + ': Skipping deletion of existing data');
          return cb();
        }

        async.forEach(filenames, function(filename, cb) {
          db.collection(filename.collection, function(e, collection) {
            collection.remove({
              agency_key: agency_key
            }, cb);
          });
        }, function(e) {
          cb(e, 'remove');
        });
      }


      function importFiles(cb) {
        // Loop through each file and add agency_key
        async.forEachSeries(filenames, function(filename, cb) {
          var filepath = path.join(gtfsDir, filename.fileNameBase + '.txt');

          if (!fs.existsSync(filepath)) {
            if (!filename.nonstandard) {
              log(agency_key + ': Importing data - No ' + filename.fileNameBase + '.txt file found');
            }

            return cb();
          }

          log(agency_key + ': Importing data - ' + filename.fileNameBase + '.txt');
          db.collection(filename.collection, function(e, collection) {
            if (e) return handleError(e);
            var input = fs.createReadStream(filepath);

            var parser = csv.parse({
              columns: true,
              relax: true
            });

            var lines = [];

            parser.on('readable', function() {
              while(line = parser.read()) {
                //remove null values
                for(var key in line) {
                  if (line[key] === null) {
                    delete line[key];
                  }
                }

                //add agency_key
                line.agency_key = agency_key;

                //convert fields that should be int
                var integerFields = [
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
                  'timepoint'
                ];

                integerFields.forEach(function(fieldName) {
                  if (line[fieldName]) {
                    line[fieldName] = parseInt(line[fieldName], 10);
                  }
                });

                //convert fields that should be float
                var floatFields = [
                  'price',
                  'shape_dist_traveled',
                  'shape_pt_lat',
                  'shape_pt_lon',
                  'stop_lat',
                  'stop_lon'
                ];

                floatFields.forEach(function(fieldName) {
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

            parser.on('end', function() {
              var chunkSize = 10000;
              var chunks = _.chunk(lines, chunkSize);

              // only insert 1 chunk at once in order to avoid an out-of-memory error
              var queue = async.queue(function(chunk, cb) {
                collection.insertMany(chunk, function(e) {
                  if (e) {
                    log('ERROR during mongo insertMany chunk ' + filename.fileNameBase);
                    handleError(e);
                    return cb(e);
                  }
                  cb();
                });
              }, 1);

              queue.drain = function () {
                cb();
              };

              queue.push(chunks, function (err) {
                if (err) {
                  log('ERROR SINGLE CALLBACK item processing ' + filename.fileNameBase);
                } else {
                  // ignore we don't want to fill the screen with unnecessary information
                }
              });
            });
            parser.on('error', handleError);
            input.pipe(parser);
          });
        }, function(e) {
          cb(e, 'import');
        });
      }


      function postProcess(cb) {
        log(agency_key + ': Post Processing data');

        async.series([
          agencyCenter,
          updatedDate
        ], function() {
          cb();
        });
      }


      function agencyCenter(cb) {
        var lat = (agency_bounds.ne[0] - agency_bounds.sw[0]) / 2 + agency_bounds.sw[0];
        var lon = (agency_bounds.ne[1] - agency_bounds.sw[1]) / 2 + agency_bounds.sw[1];
        var agency_center = [lat, lon];

        db.collection('agencies')
          .update({
            agency_key: agency_key
          }, {
            $set: {
              agency_bounds: agency_bounds,
              agency_center: agency_center
            }
          }, cb);
      }


      function updatedDate(cb) {
        db.collection('agencies')
          .update({
            agency_key: agency_key
          }, {
            $set: {
              date_last_updated: Date.now()
            }
          }, cb);
      }
    }
  });
}

function handleError(e) {
  console.error(e || 'Unknown Error');
  process.exit(1);
}

// Allow script to be called directly from commandline or required (for testable code)
if (invocation === 'direct') {
  main(config, function() {
    process.exit();
  });
} else {
  module.exports = main;
}
