var url = require('url')
  , request = require('request')
  , exec = require('child_process').exec
  , fs = require('fs')
  , csv = require('csv')
  , async = require('async')
  , mongoose = require('mongoose')
  , Db = require('mongodb').Db
  , Connection = require('mongodb').Connection
  , Server = require('mongodb').Server
  , BSON = require('mongodb').BSONNative
  , dbName = process.env['MONGO_NODE_DRIVER_DATABASE'] || 'db'
  , host = process.env['MONGO_NODE_DRIVER_HOST'] || 'localhost'
  , port = process.env['MONGO_NODE_DRIVER_PORT'] || Connection.DEFAULT_PORT; 
  , db = new Db(dbName, new Server(host, port, {}), {native_parser:true})
  , mongooseDb = mongoose.connect('mongodb://' + host + '/' + dbName); 

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
      schema: Agency = mongooseDb.model('Agency')
    , fileNameBase: 'agency'
    , collection: 'agencies'
  },
  {
      schema: CalendarDate = mongooseDb.model('CalendarDate')
    , fileNameBase: 'calendar_dates'
    , collection: 'calendardates'
  },
  {
      schema: Calendar = mongooseDb.model('Calendar')
    , fileNameBase: 'calendar'
    , collection: 'calendars'
  },
  {   schema: FareAttribute = mongooseDb.model('FareAttribute')
    , fileNameBase: 'fare_attributes'
    , collection: 'fareattributes'
  },
  {   schema: FareRule = mongooseDb.model('FareRule')
    , fileNameBase: 'fare_files'
    , collection: 'farerules'
  },
  {
      schema: FeedInfo = mongooseDb.model('FeedInfo')
    , fileNameBase: 'feed_info'
    , collection: 'feedinfos'
  },
  {   schema: Frequencies = mongooseDb.model('Frequencies')
    , fileNameBase: 'frequencies'
    , collection: 'frequencies'
  },
  {
      schema: Route = mongooseDb.model('Route')
    , fileNameBase: 'routes'
    , collection: 'routes'
  },
  {   schema: StopTime = mongooseDb.model('StopTime')
    , fileNameBase: 'stop_times'
    , collection: 'stoptimes'
  },
  {
      schema: Stop = mongooseDb.model('Stop')
    , fileNameBase: 'stops'
    , collection: 'stops'
  },
  {
      schema: Transfer = mongooseDb.model('Transfer')
    , fileNameBase: 'transfers'
    , collection: 'transfers'
  },
  {
      schema: Trip = mongooseDb.model('Trip')
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
  setTimeout(process.exit, 2000);
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
    importFiles,
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
  
  function importFiles(cb){
    db.open(function(err, db) { 
    
      //Loop through each file and add agency_key and linebreak at end
      async.forEachSeries(GTFSFiles, function(GTFSFile, cb){
        console.log(agency_key + ': ' + GTFSFile.fileNameBase + ' Importing data');
        db.collection(GTFSFile.collection, function(err, collection){
          csv()
            .fromPath(downloadDir + '/' + GTFSFile.fileNameBase + '.txt', {columns: true})
            .on('data', function(line, index){
               //remove null values
              for(var key in line){
                if(line[key] === null){
                  delete line[key];
                }
              }
              
              //add agency_key
              line.agency_key = agency_key;

              //convert fields that should be int
              if(line.stop_sequence){
                line.stop_sequence = parseInt(line.stop_sequence, 10);
              }
              if(line.direction_id){
                line.direction_id = parseInt(line.direction_id, 10);
              }

              //make lat/lon array
              if(line.stop_lat && line.stop_lon){
                line.loc = [parseFloat(line.stop_lon), parseFloat(line.stop_lat)];
                
                //Calulate agency bounds
                if(agency_bounds.sw[0] > line.loc[0] || !agency_bounds.sw[0]){
                  agency_bounds.sw[0] = line.loc[0];
                }
                if(agency_bounds.ne[0] < line.loc[0] || !agency_bounds.ne[0]){
                  agency_bounds.ne[0] = line.loc[0];
                }
                if(agency_bounds.sw[1] > line.loc[1] || !agency_bounds.sw[1]){
                  agency_bounds.sw[1] = line.loc[1];
                }
                if(agency_bounds.ne[1] < line.loc[1] || !agency_bounds.ne[1]){
                  agency_bounds.ne[1] = line.loc[1];
                }
              }

              //insert into db
              collection.insert(line, function(docs) {}); 
            })
            .on('end', function(count){
              db.close();
              cb();
            })
            .on('error',function(e){
              cb();
            });
        });
      }, function(e){
        db.close();
        //update agency with bounds and center
        var agency_center = [
            (agency_bounds.ne[0] - agency_bounds.sw[0])/2 + agency_bounds.sw[0]
          , (agency_bounds.ne[1] - agency_bounds.sw[1])/2 + agency_bounds.sw[1]
          ];
     
        Agency.update(
            {agency_key: agency_key}
          , {agency_bounds: agency_bounds, agency_center: agency_center}
          , cb);
      });
    });
  }

}
