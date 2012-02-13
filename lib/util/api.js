var url = require('url')
  , exec = require('child_process').exec
  , fs = require('fs')
  , csv = require('csv')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , db = mongoose.connect('mongodb://localhost/db');
  
/**
 * Schema definition
 */

// recursive embedded-document schema

var AgencySchema = new Schema({
    agency_key      :  { type: String }
  , agency_id       :  { type: String }
  , agency_name     :  { type: String }
  , agency_url      :  { type: String }
  , agency_timezone :  { type: String }
  , agency_lang     :  { type: String }
  , agency_phone    :  { type: String }
  , agency_fare_url :  { type: String }
});

var Agency = mongoose.model('Agency', AgencySchema);

exports.downloadGTFS = function(req, res){
  
  var agency_key = req.params.agency;
  
  var DOWNLOAD_DIR = './downloads/' + agency_key + '/';
  var base_url = 'http://www.gtfs-data-exchange.com/agency/';
  var file_url = base_url + agency_key + '/latest.zip';

  // extract the file name
  var file_name = url.parse(file_url).pathname.split('/').pop();
  
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
          Agency.find({ agency_key: agency_key }, function (err, docs) {
            docs.forEach(function(doc){
              doc.remove();
            });
          });
          
          
          //Loop through each file and add to database
          var files = [
              'agency.txt'
            , 'calendar_dates.txt'
            , 'calendar.txt'
            , 'fare_attributes.txt'
            , 'fare_rules.txt'
            , 'frequencies.txt'
            , 'routes.txt'
            , 'shapes.txt'
            , 'stop_times.txt'
            , 'stops.txt'
            , 'transfers.txt'
            , 'trips.txt'
          ];
          files.forEach(function parseFile(file){
            console.log('Reading ' + file)
            csv()
              .fromPath(DOWNLOAD_DIR + file, {columns: true})
              .on('data', function(data, index){
                if(file == 'agency.txt'){
                  var instance = new Agency();
                  for(var key in data){
                    instance[key] = data[key];
                  }
                  instance.agency_key = agency_key;
                  instance.save();
                }
                
              })
              .on('end',function(count){
                console.log(file + ': '+count + ' lines');
              })
              .on('error',function(error){
                console.log(error.message);
              });
          });

          res.contentType('application/json');
          res.send({
            success: true
          });
          
        } else {
          console.log(err);
        }
      });
      
    } else {
      //something didn't work
      res.contentType('application/json');
      res.send({
        error: true
      });
      console.log(err);
    }
  });
}
