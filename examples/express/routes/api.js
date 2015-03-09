var router = require('express').Router();
var gtfs = require('gtfs');


/* AgencyList */
router.get('/agencies', function(req, res, next) {
  gtfs.agencies(function(e, data) {
    if(e) return next(e);
    res.send( data || {error: 'No agencies in database'});
  });
});


router.get('/agenciesNearby/:lat/:lon/:radiusInMiles', function(req, res, next) {
  var lat = req.params.lat,
      lon = req.params.lon,
      radius = req.params.radiusInMiles;

  gtfs.getAgenciesByDistance(lat, lon, radius, function(e, data){
    if(e) return next(e);
    res.send( data || {error: 'No agencies within radius of ' + radius + ' miles'});
  });
});


router.get('/agenciesNearby/:lat/:lon', function(req, res, next) {
  var lat = req.params.lat,
      lon = req.params.lon;

  gtfs.getAgenciesByDistance(lat, lon, function(e, data) {
    if(e) return next(e);
    res.send( data || {error: 'No agencies within default radius'});
  });
});


/* Routelist */
router.get('/routes/:agency', function(req, res, next) {
  var agency_key = req.params.agency;

  gtfs.getRoutesByAgency(agency_key, function(e, data) {
    if(e) return next(e);
    res.send( data || {error: 'No routes for agency_key ' + agency_key});
  });
});


router.get('/routesNearby/:lat/:lon/:radiusInMiles', function(req, res, next) {
  var lat = req.params.lat,
      lon = req.params.lon,
      radius = req.params.radiusInMiles;

  gtfs.getRoutesByDistance(lat, lon, radius, function(e, data) {
    if(e) return next(e);
    res.send( data || {error: 'No routes within radius of ' + radius + ' miles'});
  });
});


router.get('/routesNearby/:lat/:lon', function(req, res, next) {
  var lat = req.params.lat,
      lon = req.params.lon;

  gtfs.getRoutesByDistance(lat, lon, function(e, data) {
    if(e) return next(e);
    res.send( data || {error: 'No routes within default radius'});
  });
});


/* Shapes */
router.get('/shapes/:agency/:route_id/:direction_id', function(req, res, next) {
  var agency_key = req.params.agency,
      route_id = req.params.route_id,
      direction_id = parseInt(req.params.direction_id,10);

  gtfs.getShapesByRoute(agency_key, route_id, direction_id, function(e, data) {
    if(e) return next(e);
    res.send( data || {error: 'No shapes for agency/route/direction combination.'});
  });
});


router.get('/shapes/:agency/:route_id', function(req, res, next) {
  var agency_key = req.params.agency,
      route_id = req.params.route_id;

  gtfs.getShapesByRoute(agency_key, route_id, function(e, data) {
    if(e) return next(e);
    res.send( data || {error: 'No shapes for agency/route combination.'});
  });
});


/* Stoplist */
router.get('/stops/:agency/:route_id/:direction_id', function(req, res ,next) {
  var agency_key = req.params.agency,
      route_id = req.params.route_id,
      direction_id = parseInt(req.params.direction_id, 10);

  gtfs.getStopsByRoute(agency_key, route_id, direction_id, function(e, data) {
    if(e) return next(e);
    res.send( data || {error: 'No stops for agency/route/direction combination.'});
  });
});


router.get('/stops/:agency/:route_id', function(req, res, next) {
  var agency_key = req.params.agency,
      route_id = req.params.route_id;

  gtfs.getStopsByRoute(agency_key, route_id, function(e, data) {
    if(e) return next(e);
    res.send( data || {error: 'No stops for agency/route combination.'});
  });
});


router.get('/stopsNearby/:lat/:lon/:radiusInMiles', function(req, res, next) {
  var lat = req.params.lat,
      lon = req.params.lon,
      radius = req.params.radiusInMiles;

  gtfs.getStopsByDistance(lat, lon, radius, function(e, data) {
    if(e) return next(e);
    res.send( data || {error: 'No stops within radius of ' + radius + ' miles'});
  });
});


router.get('/stopsNearby/:lat/:lon', function(req, res, next) {
  var lat = req.params.lat,
      lon = req.params.lon;

  gtfs.getStopsByDistance(lat, lon, function(e, data) {
    if(e) return next(e);
    res.send( data || {error: 'No stops within default radius'});
  });
});


/* Times */
router.get('/times/:agency/:route_id/:stop_id/:direction_id', function(req, res, next) {
  var agency_key = req.params.agency,
      route_id = req.params.route_id,
      stop_id = req.params.stop_id,
      direction_id = parseInt(req.params.direction_id,10);

  gtfs.getTimesByStop(agency_key, route_id, stop_id, direction_id, function(e, data) {
    if(e) return next(e);
    res.send( data || {error: 'No times for agency/route/stop/direction combination.'});
  });
});


router.get('/times/:agency/:route_id/:stop_id', function(req, res, next) {
  var agency_key = req.params.agency,
      route_id = req.params.route_id,
      stop_id = req.params.stop_id;

  gtfs.getTimesByStop(agency_key, route_id, stop_id, function(e, data) {
    if(e) return next(e);
    res.send( data || {error: 'No times for agency/route/stop combination.'});
  });
});


module.exports = router;
