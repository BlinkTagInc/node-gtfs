var url = require('url')
  , exec = require('child_process').exec
  , fs = require('fs')
  , csv = require('csv');

exports.downloadGTFS = function(req, res){
  var DOWNLOAD_DIR = './downloads/' + req.params.agency + '/';
  var base_url = 'http://www.gtfs-data-exchange.com/agency/';
  var file_url = base_url + req.params.agency + '/latest.zip';

  // extract the file name
  var file_name = url.parse(file_url).pathname.split('/').pop();
  
  // excute wget using child_process' exec function
  var wget = 'wget -N -O ' + DOWNLOAD_DIR + 'latest.zip ' + file_url;
  var child = exec(wget, function(err, stdout, stderr) {
    if (!err){
      //unzip file
      var unzip = 'unzip ' + DOWNLOAD_DIR + 'latest.zip -d ' + DOWNLOAD_DIR;
      var child = exec(unzip, function(err, stdout, stderr) {
        if(!err){
          res.contentType('application/json');
          res.send({
            success: true
          });
          console.log(file_name + ' downloaded to ' + DOWNLOAD_DIR);
         
        }
      });
      
    } else {
      //something didn't work
      res.contentType('application/json');
      res.send({
        success: false
      });
    }
  });
}

exports.parseGTFS = function(req, res){
  
}