var errors = require('./lib/util/errors')
  , api = require('./lib/util/api');

module.exports = function routes(app){

  //AgencyList
   app.get('/api/agencies', api.getAllAgencies);

  //Routelist
  app.get('/api/routes/:agency', api.getRoutesByAgency);
  app.get('/api/routes', api.getRoutesByAgency);
  
  //Stoplist
  app.get('/api/stops/:agency/:route_id/:direction_id', api.getStopsByRoute);
  app.get('/api/stops/:agency/:route_id', api.getStopsByRoute);
  
  //Download
  app.get('/api/download/:agency', api.downloadGTFS);
  
  //Nothing specified
  app.all('*', function notFound(req, res) {
    
    res.contentType('application/json');
    res.send({
      error: 'No API call specified'
    });
  });

}