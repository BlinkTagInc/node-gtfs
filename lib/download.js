var url = require('url')
  , request = require('request')
  , exec = require('child_process').exec
  , fs = require('fs')
  , csv = require('csv')
  , async = require('async')
  , mongoose = require('mongoose')
  , dbName = 'db'
  , db = mongoose.connect('mongodb://localhost/' + dbName);

require('../models/Agency');
require('../models/Calendar');
require('../models/CalendarDate');
require('../models/FareAttribute');
require('../models/FareRule');
require('../models/FeedInfo');
require('../models/Frequencies');
require('../models/Route');
require('../models/Stop');
require('../models/StopTime');
require('../models/Transfer');
require('../models/Trip');

var GTFSFiles = [
  {
      schema: Agency = db.model('Agency')
    , fileNameBase: 'agency'
    , collection: 'agencies'
  },
  {
      schema: CalendarDate = db.model('CalendarDate')
    , fileNameBase: 'calendar_dates'
    , collection: 'calendardates'
  },
  {
      schema: Calendar = db.model('Calendar')
    , fileNameBase: 'calendar'
    , collection: 'calendars'
  },
  {   schema: FareAttribute = db.model('FareAttribute')
    , fileNameBase: 'fare_attributes'
    , collection: 'fareattributes'
  },
  {   schema: FareRule = db.model('FareRule')
    , fileNameBase: 'fare_files'
    , collection: 'farerules'
  },
  {
      schema: FeedInfo = db.model('FeedInfo')
    , fileNameBase: 'feed_info'
    , collection: 'feedinfos'
  },
  {   schema: Frequencies = db.model('Frequencies')
    , fileNameBase: 'frequencies'
    , collection: 'frequencies'
  },
  {
      schema: Route = db.model('Route')
    , fileNameBase: 'routes'
    , collection: 'routes'
  },
  {   schema: StopTime = db.model('StopTime')
    , fileNameBase: 'stop_times'
    , collection: 'stoptimes'
  },
  {
      schema: Stop = db.model('Stop')
    , fileNameBase: 'stops'
    , collection: 'stops'
  },
  {
      schema: Transfer = db.model('Transfer')
    , fileNameBase: 'transfers'
    , collection: 'transfers'
  },
  {
      schema: Trip = db.model('Trip')
    , fileNameBase: 'trips'
    , collection: 'trips'
  }
];


//loop through all agencies specified (remove first two arguments)
process.argv.splice(0, 2);

if(process.argv.length < 1){
  console.log('Error: No agency_key specified\nTry running `node download.js capital-metro` to load transit data');
  process.exit();
}

//create queue for agency list
var q = async.queue(downloadGTFS, 1);

q.drain = function(e) {
  console.log('All agencies completed (' + process.argv.length + ' total)');
  setTimeout(process.exit(), 2000);
}

process.argv.forEach(function(agency_key){
  q.push({agency_key: agency_key}, function(e){
    if(e){
      console.log(e);
    }
  })
});


function downloadGTFS(task, cb){
  var agency_key = task.agency_key
    , downloadDir = 'downloads'
    , agency_bounds = {sw: [], ne: []};
    
  
  console.log('Starting ' + agency_key);

  async.series([
    cleanupFiles,
    downloadFiles,
    transformFiles,
    processFiles,
    postProcess,
    cleanupFiles
  ], function(e, results){
    console.log( e || agency_key + ': Completed')
    cb();
  });

  function cleanupFiles(cb){
    //remove old downloaded files
    exec('rm -rf ' + downloadDir, function(e, stdout, stderr){
      try{
        //create downloads directory
        fs.mkdirSync(downloadDir);
        cb();
      } catch(e){ console.log(e) }
    });
  }
  
  function downloadFiles(cb){
    var downloadUrl = 'http://www.gtfs-data-exchange.com/agency/' + agency_key + '/latest.zip'
      , fileName = downloadDir + '/latest.zip';

    //do download
    request(downloadUrl, processFile).pipe(fs.createWriteStream(fileName));

    function processFile(e, response, body){
      if(response.statusCode == 200){
        console.log(agency_key + ': Download successful');
      
        //remove old text files and unzip file
        var unzip = 'unzip ' + downloadDir + '/latest.zip -d ' + downloadDir;
        exec(unzip, function(e, stdout, stderr) {
          if(!e && !stderr){
            console.log(agency_key + ': Unzip successful');
          
            //remove old db records based on agency_key
            async.forEach(GTFSFiles, function(GTFSFile, cb){
              GTFSFile.schema.remove({ agency_key: agency_key }, cb);
            }, function(e){
              cb(e, 'download');
            });
          
          } else { 
            cb(new Error(agency_key + ': Unzip failed'), 'download');
          }
        });

      } else {
        cb(new Error('Couldn\'t download files'));
      }
    }
  }
  
  function transformFiles(cb){
    //Loop through each file and add agency_key and linebreak at end
    async.forEachSeries(GTFSFiles, function(GTFSFile, cb){
      console.log(agency_key + ': ' + GTFSFile.fileNameBase + ' Transforming data');
      exec('echo "" >> ' + downloadDir + '/' + GTFSFile.fileNameBase + '.txt', function(e, stdout, stderr){
        csv()
          .fromPath(downloadDir + '/' + GTFSFile.fileNameBase + '.txt')
          .toPath(downloadDir + '/' + GTFSFile.fileNameBase + '.csv')
          .transform(function(line, index){
            if(index == 0){
              line.push('agency_key');
            } else if(line.length > 1) {
              //add quotes around all fields that should be strings
              line.forEach(function(item){
                console.log(item);
              });
              line.push(agency_key);
            }
            return line;
          })
          .on('end', function(count){
            cb();
          })
          .on('error',function(e){
            cb();
          });
      });
    }, function(e){
      //don't pass along errors
      cb();
    });
  }

  function processFiles(cb){
    var maxLines = 50000;
    //Loop through each file and import into database using mongoimport
    async.forEachSeries(GTFSFiles, function(GTFSFile, cb){
      
      //count lines
      exec('wc -l ' + downloadDir + '/' + GTFSFile.fileNameBase + '.csv', function(e, stdout, stderr){
        var lineCount = stdout.split(' ').filter(Number).shift();
        if(!lineCount || stderr){
          //file doesn't exist or have any lines
          console.log(agency_key + ': ' + GTFSFile.fileNameBase + ' (no lines)');
          cb();
        } else {
          console.log(agency_key + ': ' + GTFSFile.fileNameBase + ' (' + lineCount + ' lines)');
         
          exec('head -n 1 ' + downloadDir + '/' + GTFSFile.fileNameBase + '.csv', function(e, stdout, stderr){ 
            if(stdout){
              //get list of fields from first line, remove line break
              var fieldList = stdout.replace(/(\r\n|\n|\r)/gm,"");

              //remove first line, write to temporary file and split files if lineCount is large
              var move = 'mkdir ' + downloadDir + '/csv;' +
                         'rm ' + downloadDir + '/csv/*;' +
                         'sed \'1d\' ' + downloadDir + '/' + GTFSFile.fileNameBase + '.csv > ' + downloadDir + '/csv/' + GTFSFile.fileNameBase + '.csv;';

              if(lineCount > maxLines){
                move +=  'cd ' + downloadDir + '/csv;' +
                         'split -l ' + maxLines + ' ' + GTFSFile.fileNameBase + '.csv;';
              }

              //If its a large file, break into chunks to process file, else just process it
              exec(move, function(e, stdout, stderr) {
                importFile(GTFSFile.collection, fieldList, cb);
              });
            } else {
              cb(new Error('Can\'t get first line'));
            }
          });
        }
      });
    }, cb);
    
    function importFile(collection, fieldList, cb){
      //Do mongoimport of each file
      fs.readdir(downloadDir + '/csv/', function(e, files){
        if(files){
          async.forEachSeries(files, function(file, cb){
            if(files.length > 1){
              console.log(agency_key + ': ' + collection + ': part ' + (files.indexOf(file) + 1) + ' of ' + files.length);
            }

            var mongoimport = 'mongoimport -d ' + dbName + ' -c ' + collection + ' --type csv -f "' + fieldList + '" --ignoreBlanks ' + downloadDir + '/csv/' + file + ';';
            
            exec(mongoimport, function(e, stdout, stderr) {
              if(stderr){
                cb(new Error(stderr));
              } else {
                cb(e);
              }
            });
          }, cb);
        } else {
          cb(new Error('Can\'t find Files'));
        }
      });
    }
  }
  
  
  function postProcess(cb){
    console.log(agency_key + ': Post-processing');
    //Find Agency Bounding Box and add lat/lon for each stop
    Stop.find({agency_key: agency_key}, function(e, stops){
      var stopCounter = 0;
      
      stops.forEach(function(stop){
        stop.loc = [parseFloat(stop.stop_lon), parseFloat(stop.stop_lat)];

        //check each stop against agency bounds to find agency_bounds
        if(!agency_bounds.sw.length){
          agency_bounds = {
              sw: [stop.loc[0], stop.loc[1]]
            , ne: [stop.loc[0], stop.loc[1]]
          }
        } else {
          if(agency_bounds.sw[0] > stop.loc[0]){
            agency_bounds.sw[0] = stop.loc[0];
          }
          if(agency_bounds.ne[0] < stop.loc[0]){
            agency_bounds.ne[0] = stop.loc[0];
          }
          if(agency_bounds.sw[1] > stop.loc[1]){
            agency_bounds.sw[1] = stop.loc[1];
          } else if(agency_bounds.ne[1] < stop.loc[1]){
            agency_bounds.ne[1] = stop.loc[1];
          }
          stop.save(saveCb);
        }
      });

      function saveCb(){
        stopCounter++;
        if(stopCounter == (stops.length - 1)){
           //update agency with bounds and center
         var agency_center = [
            (agency_bounds.ne[0] - agency_bounds.sw[0])/2 + agency_bounds.sw[0]
          , (agency_bounds.ne[1] - agency_bounds.sw[1])/2 + agency_bounds.sw[1]
          ];
     
         Agency.update(
              {agency_key: agency_key}
            , {agency_bounds: agency_bounds, agency_center: agency_center}
            , cb);
        }
      }
    });
  }
}
