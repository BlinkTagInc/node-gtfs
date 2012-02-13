var url = require('url')
  , exec = require('child_process').exec
  , fs = require('fs')
  , csv = require('csv')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , db = mongoose.connect('mongodb://localhost/db');
  
/**
 * Schema definitions
 */

var Agency = mongoose.model('Agency', new Schema({
    agency_key        :  { type: String }
  , agency_id         :  { type: String }
  , agency_name       :  { type: String }
  , agency_url        :  { type: String }
  , agency_timezone   :  { type: String }
  , agency_lang       :  { type: String }
  , agency_phone      :  { type: String }
  , agency_fare_url   :  { type: String }
}));

var CalendarDate = mongoose.model('CalendarDate', new Schema({
    agency_key        :  { type: String }
  , service_id        :  { type: String }
  , date              :  { type: String }
  , exception_type    :  { type: String }
}));

var Calendar = mongoose.model('Calendar', new Schema({
    agency_key        :  { type: String }
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
    agency_key        :  { type: String }
  , fare_id           :  { type: String }
  , price             :  { type: String }
  , currency_type     :  { type: String }
  , payment_method    :  { type: String }
  , transfers         :  { type: String }
  , transfer_duration :  { type: String }
}));

var FareRule = mongoose.model('FareRule', new Schema({
    agency_key        :  { type: String }
  , fare_id           :  { type: String }
  , route_id          :  { type: String }
  , origin_id         :  { type: String }
  , destination_id    :  { type: String }
  , contains_id       :  { type: String }
}));

var FeedInfo = mongoose.model('FeedInfo', new Schema({
    agency_key        :  { type: String }
  , feed_publisher_name :  { type: String }
  , feed_publisher_url :  { type: String }
  , feed_lang         :  { type: String }
  , feed_start_date   :  { type: String }
  , feed_end_date     :  { type: String }
  , feed_version      :  { type: String }
}));

var Frequencies = mongoose.model('Frequencies', new Schema({
    agency_key        :  { type: String }
  , trip_id           :  { type: String }
  , start_time        :  { type: String }
  , end_time          :  { type: String }
  , headway_secs      :  { type: String }
  , exact_times       :  { type: String }
}));

var Route = mongoose.model('Route', new Schema({
    agency_key        :  { type: String }
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
    agency_key        :  { type: String }
  , trip_id           :  { type: String }
  , arrival_time      :  { type: String }
  , departure_time    :  { type: String }
  , stop_id           :  { type: String }
  , stop_sequence     :  { type: String }
  , stop_headsign     :  { type: String }
  , pickup_type       :  { type: String }
  , drop_off_type     :  { type: String }
  , shape_dist_traveled :  { type: String }
}));

var Stop = mongoose.model('Stop', new Schema({
    agency_key        :  { type: String }
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
    agency_key        :  { type: String }
  , from_stop_id      :  { type: String }
  , to_stop_id        :  { type: String }
  , transfer_type     :  { type: String }
  , min_transfer_time :  { type: String }
}));

var Trip = mongoose.model('Trip', new Schema({
    agency_key        :  { type: String }
  , route_id          :  { type: String }
  , service_id        :  { type: String }
  , trip_id           :  { type: String }
  , trip_headsign     :  { type: String }
  , trip_short_name   :  { type: String }
  , direction_id      :  { type: String }
  , block_id          :  { type: String }
  , shape_id          :  { type: String }
}));


exports.getAllAgencies = function(req, res){
  //gets a list of all agencies 
  
  Agency.find({}, function(err, agencies){
    if(agencies.length){
      res.send(agencies);
    } else {
      console.log(err);
      res.send({
        error: 'No Agencies'
      })
    }
  });
}


exports.getRoutesByAgency = function(req, res){
  //gets routes for one agency
  var agency_key = req.params.agency;

  Route.find({ agency_key: agency_key }, function(err, routes){
    if(routes.length){
      res.send(routes);
    } else {
      console.log(err);
      res.send({
        error: 'Invalid agency_key'
      })
    }
  });
}


exports.getStopsByRoute = function(req, res){
  //gets stops for one route
  var agency_key = req.params.agency
    , route_id = req.params.route_id
    , direction_id = (req.params.direction_id) ? req.params.direction_id : 0;
    
    console.log(direction_id);
  
  Trip.find({ 
      agency_key: agency_key
    , route_id: route_id
    , direction_id: direction_id 
  }, function(err, trips){
    if(trips.length){
      res.send(trips);
    } else {
      console.log(err);
      res.send({
        error: 'Invalid route_id and/or agency_key'
      })
    }
  });
}



exports.downloadGTFS = function(req, res){
  
  var agency_key = req.params.agency
    , DOWNLOAD_DIR = './downloads/' + agency_key + '/'
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
          Agency.find({ agency_key: agency_key }, removeAll);
          CalendarDate.find({ agency_key: agency_key }, removeAll);
          Calendar.find({ agency_key: agency_key }, removeAll);
          FareAttribute.find({ agency_key: agency_key }, removeAll);
          FareRule.find({ agency_key: agency_key }, removeAll);
          FeedInfo.find({ agency_key: agency_key }, removeAll);
          Frequencies.find({ agency_key: agency_key }, removeAll);
          Route.find({ agency_key: agency_key }, removeAll);
          StopTime.find({ agency_key: agency_key }, removeAll);
          Stop.find({ agency_key: agency_key }, removeAll);
          Transfer.find({ agency_key: agency_key }, removeAll);
          Trip.find({ agency_key: agency_key }, removeAll);
          
          //Loop through each file and add to database
          var files = [
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
          ];
          files.forEach(function parseFile(fileName){
            
            csv()
              .fromPath(DOWNLOAD_DIR + fileName, {columns: true})
              .on('data', function(line, index){ saveLineToDB(line, fileName) })
              .on('end',function(count){
                console.log(fileName + ': ' + count + ' lines');
              })
              .on('error',function(error){
                console.log(error.message);
              });
          });

          res
            .contentType('application/json')
            .send({
              success: true
            });
          
        } else {
          console.log(err);
        }
      });
      
    } else {
      //something didn't work
      console.log(err);
      
      res
        .contentType('application/json')
        .send({
          error: true
        });
    }
  });
  

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
    instance.save();
  }
  
  function removeAll(err, docs) {
    docs.forEach(function(doc){
      doc.remove();
    });
  }
  
}
