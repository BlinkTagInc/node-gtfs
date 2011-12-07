var errors = require('./lib/util/errors')
  , api = require('./lib/util/api');

module.exports = function routes(app){

  //Routelist
  app.get('/api/routes/:agency', function(req, res){

    //Spit back variables from URL
    for(i in req.query){ console.log(i+": "+req.query[i]); }
  
    res.contentType('application/json');
    res.send({
        agency: req.params.agency
      , routes: [
        {
          shortName: '35',
          routeName: '35-Eureka',
          predictionType: 'schedule'
        }
      ]
    });
      
  });
  
  
  app.get('/api/routes/download/:agency', api.downloadGTFS);
  
  //Nothing specified
  app.all('*', function notFound(req, res) {
    
    res.contentType('application/json');
    res.send({
      error: 'No API call specified'
    });
  });

}