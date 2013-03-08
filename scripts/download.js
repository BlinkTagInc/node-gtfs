//load config.js
try {
  var config = require('../config.js');
} catch (e) {
  console.log(e)
}

var url = require('url')
  , request = require('request')
  , exec = require('child_process').exec
  , fs = require('fs')
  , path = require('path')
  , csv = require('csv')
  , async = require('async')
  , downloadDir = 'downloads'
  , Db = require('mongodb').Db
  , Connection = require('mongodb').Connection
  , Server = require('mongodb').Server
  , BSON = require('mongodb').BSONNative
  , dbName = process.env['MONGO_NODE_DATABASE'] || config.mongo_node_database
  , host = process.env['MONGO_NODE_HOST'] || config.mongo_node_host
  , port = process.env['MONGO_NODE_PORT'] || config.mongo_node_port || Connection.DEFAULT_PORT
  , db = new Db(dbName, new Server(host, port, {safe: false}))
  , q;

var GTFSFiles = [
  {
      fileNameBase: 'agency'
    , collection: 'agencies'
  },
  {
      fileNameBase: 'calendar_dates'
    , collection: 'calendardates'
  },
  {
      fileNameBase: 'calendar'
    , collection: 'calendars'
  },
  {
      fileNameBase: 'fare_attributes'
    , collection: 'fareattributes'
  },
  {
      fileNameBase: 'fare_files'
    , collection: 'farerules'
  },
  {
      fileNameBase: 'feed_info'
    , collection: 'feedinfos'
  },
  {
      fileNameBase: 'frequencies'
    , collection: 'frequencies'
  },
  {
      fileNameBase: 'routes'
    , collection: 'routes'
  },
  {
      fileNameBase: 'stop_times'
    , collection: 'stoptimes'
  },
  {
      fileNameBase: 'stops'
    , collection: 'stops'
  },
  {
      fileNameBase: 'transfers'
    , collection: 'transfers'
  },
  {
      fileNameBase: 'trips'
    , collection: 'trips'
  }
];

if(!config.agencies){
  console.log('Error: No agency_key specified in config.js\nTry adding \'capital-metro\' to the agencies in config.js to load transit data');
  process.exit();
}

//open database and create queue for agency list
db.open(function(err, db) { 
  q = async.queue(downloadGTFS, 1);
  //loop through all agencies specified
  config.agencies.forEach(function(agency_key){
    q.push({agency_key: agency_key}, function(e){
      if(e){
        console.log(e);
      }
    })
  });

  q.drain = function(e) {
    console.log('All agencies completed (' + config.agencies.length + ' total)');
    setTimeout(function(){ 
      db.close();
      process.exit();
    }, 2000);
  }
});


function downloadGTFS(task, cb){
  var agency_key = task.agency_key
    , agency_bounds = {sw: [], ne: []};


  console.log('Starting ' + agency_key);

  async.series([
    cleanupFiles,
    downloadFiles,
    removeDatabase,
    importFiles,
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
  
  /** This function downloads the GTFS feed for the agency specified by agency_key. It is used as part of the
  node-gtfs update process.
  */
  function downloadFiles(cb){
    //Figure out the download URL. Usually the GTFS files are downloaded from gtfs-data-exchange.com but
    //sometimes a different URL is used; if a URL is specified in config.agencyUrls then use that one.
    var downloadUrl = ''
  	
  	if(config.agencyUrls[agency_key] != undefined) {
  		downloadUrl = config.agencyUrls[agency_key], fileName = downloadDir + '/latest.zip';
  	} else {
  		downloadUrl = 'http://www.gtfs-data-exchange.com/agency/' + agency_key + '/latest.zip'
      , fileName = downloadDir + '/latest.zip';
  	}

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
            cb(null, 'download');
          } else { 
            cb(new Error(agency_key + ': Unzip failed'), 'download');
          }
        });

      } else {
        cb(new Error('Couldn\'t download files'));
      }
    }
  }


  function removeDatabase(cb){
    //remove old db records based on agency_key
    async.forEach(GTFSFiles, function(GTFSFile, cb){
      db.collection(GTFSFile.collection, function(e, collection){
        collection.remove({ agency_key: agency_key }, {safe: true}, cb);
      });
    }, function(e){
        cb(e, 'remove');
    });
  }


  function importFiles(cb){
    //Loop through each file and add agency_key
    async.forEachSeries(GTFSFiles, function(GTFSFile, cb){
      if(GTFSFile){
        var filepath = path.join(downloadDir, GTFSFile.fileNameBase + '.txt');
        if (!fs.existsSync(filepath)) return cb();
        console.log(agency_key + ': ' + GTFSFile.fileNameBase + ' Importing data');
        db.collection(GTFSFile.collection, function(e, collection){
          csv()
            .from.path(filepath, {columns: true})
            .on('record', function(line, index){
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
              collection.insert(line, {async: false});
            })
            .on('end', function(count){
              cb();
            })
            .on('error',function(e){
              cb();
            });
        });
      }
    }, function(e){
      cb(e, 'import');
    });
  }

  function postProcess(cb){
    console.log(agency_key + ':  Post Processing data');

    async.series([
        agencyCenter
      , longestTrip
    ], function(e, results){
      cb();
    });
  }

  function agencyCenter(cb){
    var agency_center = [
        (agency_bounds.ne[0] - agency_bounds.sw[0])/2 + agency_bounds.sw[0]
      , (agency_bounds.ne[1] - agency_bounds.sw[1])/2 + agency_bounds.sw[1]
    ];

    db.collection('agencies')
      .update({agency_key: agency_key}, {$set: {agency_bounds: agency_bounds, agency_center: agency_center}}, {safe: true}, cb);
  }

  function longestTrip(cb){
    /*db.trips.find({agency_key: agency_key}).for.toArray(function(e, trips){
        async.forEach(trips, function(trip, cb){
          db.collection('stoptimes', function(e, collection){

          });
          console.log(trip);
          cb();
        }, cb);
      });
    });*/
    cb();
  }

}
