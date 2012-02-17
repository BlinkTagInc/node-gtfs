var url = require('url')
  , exec = require('child_process').exec
  , fs = require('fs')
  , csv = require('csv')
  , async = require('async')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , db = mongoose.connect('mongodb://localhost/db')
  , tools = require('./util/tools.js');
  
/**
 * Schema definitions
 */
 

var Agency = mongoose.model('Agency', new Schema({
    agency_key        :  { type: String, index: true }
  , agency_id         :  { type: String }
  , agency_name       :  { type: String }
  , agency_url        :  { type: String }
  , agency_timezone   :  { type: String }
  , agency_lang       :  { type: String }
  , agency_phone      :  { type: String }
  , agency_fare_url   :  { type: String }
}));

var CalendarDate = mongoose.model('CalendarDate', new Schema({
    agency_key        :  { type: String, index: true }
  , service_id        :  { type: String }
  , date              :  { type: String }
  , exception_type    :  { type: String }
}));

var Calendar = mongoose.model('Calendar', new Schema({
    agency_key        :  { type: String, index: true }
  , service_id        :  { type: String }
  , monday            :  { type: String }
  , tuesday           :  { type: String }
  , wednesday         :  { type: String }
  , thursday          :  { type: String }
  , friday            :  { type: String }
  , saturday          :  { type: String }
  , sunday            :  { type: String }
  , start_date        :  { type: String }
  , end_date          :  { type: String }
}));

var FareAttribute = mongoose.model('FareAttribute', new Schema({
    agency_key        :  { type: String, index: true }
  , fare_id           :  { type: String }
  , price             :  { type: String }
  , currency_type     :  { type: String }
  , payment_method    :  { type: String }
  , transfers         :  { type: String }
  , transfer_duration :  { type: String }
}));

var FareRule = mongoose.model('FareRule', new Schema({
    agency_key        :  { type: String, index: true }
  , fare_id           :  { type: String }
  , route_id          :  { type: String }
  , origin_id         :  { type: String }
  , destination_id    :  { type: String }
  , contains_id       :  { type: String }
}));

var FeedInfo = mongoose.model('FeedInfo', new Schema({
    agency_key        :  { type: String, index: true }
  , feed_publisher_name :  { type: String }
  , feed_publisher_url :  { type: String }
  , feed_lang         :  { type: String }
  , feed_start_date   :  { type: String }
  , feed_end_date     :  { type: String }
  , feed_version      :  { type: String }
}));

var Frequencies = mongoose.model('Frequencies', new Schema({
    agency_key        :  { type: String, index: true }
  , trip_id           :  { type: String }
  , start_time        :  { type: String }
  , end_time          :  { type: String }
  , headway_secs      :  { type: String }
  , exact_times       :  { type: String }
}));

var Route = mongoose.model('Route', new Schema({
    agency_key        :  { type: String, index: true }
  , route_id          :  { type: String }
  , agency_id         :  { type: String }
  , route_short_name  :  { type: String }
  , route_long_name   :  { type: String }
  , route_desc        :  { type: String }
  , route_type        :  { type: String }
  , route_url         :  { type: String }
  , route_color       :  { type: String }
  , route_text_color  :  { type: String }
}));

var StopTime = mongoose.model('StopTime', new Schema({
    agency_key        :  { type: String, index: true }
  , trip_id           :  { type: String, index: true }
  , arrival_time      :  { type: String, get: secondsToTime, set: timeToSeconds }
  , departure_time    :  { type: String, index:true, get: secondsToTime, set: timeToSeconds }
  , stop_id           :  { type: String }
  , stop_sequence     :  { type: Number, index: true }
  , stop_headsign     :  { type: String }
  , pickup_type       :  { type: String }
  , drop_off_type     :  { type: String }
  , shape_dist_traveled :  { type: String }
}));

var Stop = mongoose.model('Stop', new Schema({
    agency_key        :  { type: String, index: true }
  , stop_id           :  { type: String }
  , stop_code         :  { type: String }
  , stop_name         :  { type: String }
  , stop_desc         :  { type: String }
  , stop_lat          :  { type: String }
  , stop_lon          :  { type: String }
  , zone_id           :  { type: String }
  , stop_url          :  { type: String }
  , location_type     :  { type: String }
  , parent_station    :  { type: String }
  , stop_timezone     :  { type: String }
}));

var Transfer = mongoose.model('Transfer', new Schema({
    agency_key        :  { type: String, index: true }
  , from_stop_id      :  { type: String }
  , to_stop_id        :  { type: String }
  , transfer_type     :  { type: String }
  , min_transfer_time :  { type: String }
}));

var Trip = mongoose.model('Trip', new Schema({
    agency_key        :  { type: String, index: true }
  , route_id          :  { type: String, index: true }
  , service_id        :  { type: String, index:true }
  , trip_id           :  { type: String }
  , trip_headsign     :  { type: String }
  , trip_short_name   :  { type: String }
  , direction_id      :  { type: Number, index:true, min:0, max:1 }
  , block_id          :  { type: String }
  , shape_id          :  { type: String }
}));

function timeToSeconds(time){
  if(time instanceof Date){
    var timeParts = [ time.getHours(), time.getMinutes(), time.getSeconds() ];
  } else {
    var timeParts = time.split(':');
    if(timeParts.length != 3){
      return null;
    }
  }
  return parseInt(timeParts[0], 10) * 60 * 60 + parseInt(timeParts[1], 10) * 60 + parseInt(timeParts[2], 10);
}

function secondsToTime(seconds){
  var hour = Math.floor(seconds / (60 * 60))
    , minute = Math.floor((seconds - hour * (60 * 60)) / 60)
    , second = seconds - hour * (60 * 60) - minute * 60;
  return ((hour < 10) ? '' + '0' + hour : hour) + ':' + ((minute<10) ? '' + '0' + minute : minute) + ':' + ((second<10) ? '' + '0' + second : second);
}



var Schemas = [Agency, CalendarDate, Calendar, FareAttribute, FareRule, FeedInfo, Frequencies, Route, StopTime, Stop, Transfer, Trip];

function downloadGTFS(agency_key, callback){
  
  var DOWNLOAD_DIR = '../downloads/' + agency_key + '/'
    , base_url = 'http://www.gtfs-data-exchange.com/agency/'
    , file_url = base_url + agency_key + '/latest.zip'
    , file_name = url.parse(file_url).pathname.split('/').pop();
  
  // excute wget using child_process' exec function
  var wget = 'mkdir -p ' + DOWNLOAD_DIR + '; wget -N -O ' + DOWNLOAD_DIR + 'latest.zip ' + file_url;
  var child = exec(wget, function(err, stdout, stderr) {
    if (!err){
      console.log('Download Successful');
      
      //remove old text files and unzip file
      var unzip = 'rm ' + DOWNLOAD_DIR + '*.txt; unzip ' + DOWNLOAD_DIR + 'latest.zip -d ' + DOWNLOAD_DIR;
      var child = exec(unzip, function(err, stdout, stderr) {
        if(!err){
          console.log('Unzip Successful');
          
          //remove old db records based on agency_key
          async.forEach(Schemas, function(schema, callback){
            schema.remove({ agency_key: agency_key }, callback);
          }, function(err){
            if(err){
              console.log(err);
            } else {
              processFiles();
            }
          });
          
        } else { console.log(err); }
      });
      
    } else { console.log(err); }
  });
  
  function processFiles(){
    //Loop through each file and add to database
    [
        'agency.txt'
      , 'calendar_dates.txt'
      , 'calendar.txt'
      , 'fare_attributes.txt'
      , 'fare_rules.txt'
      , 'feed_info.txt'
      , 'frequencies.txt'
      , 'routes.txt'
      , 'stop_times.txt'
      , 'stops.txt'
      , 'transfers.txt'
      , 'trips.txt'
    ].forEach(function(fileName){
      csv()
        .fromPath(DOWNLOAD_DIR + fileName, {columns: true})
        .on('data', function(line, index){
          saveLineToDB(line, fileName) 
        })
        .on('end',function(count){
          console.log(fileName + ': ' + count + ' lines');
        })
        .on('error',function(error){
          console.log(error.message);
        });
    });
  }
  

  function saveLineToDB(line, fileName){
    var instance;
    
    switch(fileName){
      case 'agency.txt':
        instance = new Agency();
        break;
                  
      case 'calendar_dates.txt':
        instance = new CalendarDate();
        break;
                  
      case 'calendar.txt':
        instance = new Calendar();
        break;
                  
      case 'fare_attributes.txt':
        instance = new FareAttribute();
        break;
                  
      case 'fare_rules.txt':
        instance = new FareRule();
        break;
  
      case 'feed_info.txt':
        instance = new FeedInfo();
        break;
                  
      case 'frequencies.txt':
        instance = new Frequencies();
        break;      
                  
      case 'routes.txt':
        instance = new Route();
        break;
        
      case 'stop_times.txt':
        instance = new StopTime();
        break;
        
      case 'stops.txt':
        instance = new Stop();
        break;
        
      case 'transfers.txt':
        instance = new Transfer();
        break;
               
      case 'trips.txt':
        instance = new Trip();
        break;
      
    }
    
    for(var key in line){
      instance[key] = line[key];
    }
    
    instance.agency_key = agency_key;
    instance.save(callback);
  }
  
}


//loop through all agencies specified (remove first two arguments)
process.argv.splice(0, 2);

async.forEach(process.argv, downloadGTFS, function(err){
  if(err){
    console.log(err);
  }
});

