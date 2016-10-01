const _ = require('lodash');
const async = require('async');

const Route = require('../../models/Route');
const Stop = require('../../models/Stop');
const StopTime = require('../../models/StopTime');
const Trip = require('../../models/Trip');

/*
 * Returns an array of routes for the `agency_key` specified and `agency_id`
 * if specified
 */
exports.getRoutesByAgency = (agency_key, agency_id, cb) => {
  if (_.isFunction(agency_id)) {
    cb = agency_id;
    agency_id = null;
  }

  const query = {
    agency_key
  };

  if (agency_id !== null) {
    query.agency_id = agency_id;
  }

  return Route.find(query).exec(cb);
};


/*
 * Returns a route for the `route_id` specified
 */
exports.getRoutesById = (agency_key, route_id, cb) => {
  return Route.findOne({
    agency_key,
    route_id
  }).exec(cb);
};


/*
 * Returns an array of routes within a `radius` of the `lat`, `lon` specified
 */
exports.getRoutesByDistance = (lat, lon, radius, cb) => {
  if (_.isFunction(radius)) {
    cb = radius;
    radius = 1; //default is 1 mile
  }

  lat = parseFloat(lat);
  lon = parseFloat(lon);

  const radiusInDegrees = Math.round(radius / 69 * 100000) / 100000;
  let stop_ids;
  let trip_ids;
  let route_ids;
  let routes;

  async.series([
    getStopsNearby,
    getTrips,
    getRoutes,
    lookupRoutes
  ], (err) => {
    cb(err, routes);
  });

  function getStopsNearby(cb) {
    Stop
      .where('loc')
      .near(lon, lat).maxDistance(radiusInDegrees)
      .exec((err, stops) => {
        if (err) return cb(err);

        if (stops.length) {
          stop_ids = stops.reduce((memo, stop) => {
            if (stop.stop_id) {
              memo.push(stop.stop_id);
            }
            return memo;
          }, []);
        }
        cb(null, 'stops');
      });
  }

  function getTrips(cb) {
    StopTime
      .distinct('trip_id')
      .where('stop_id').in(stop_ids)
      .exec((err, results) => {
        if (err) return cb(err);

        trip_ids = results;
        cb(null, 'trips');
      });
  }

  function getRoutes(cb) {
    Trip
      .distinct('route_id')
      .where('trip_id').in(trip_ids)
      .exec((err, results) => {
        if (err) return cb(err);

        route_ids = results;
        cb(null, 'routes');
      });
  }

  function lookupRoutes(cb) {
    Route
      .where('route_id').in(route_ids)
      .exec((err, results) => {
        if (err) return cb(err);

        routes = results;
        cb(null, 'lookup');
      });
  }
};


/*
 * Returns an array of routes serving the `agency_key` and `stop_id` specified
 */
exports.getRoutesByStop = (agency_key, stop_id, cb) => {
  let trip_ids;
  let route_ids;
  let routes;

  async.series([
    getTrips,
    getRoutes,
    lookupRoutes
  ], (err) => {
    cb(err, routes);
  });

  function getTrips(cb) {
    StopTime
      .find({
        agency_key,
        stop_id: stop_id
      })
      .distinct('trip_id')
      .exec((err, results) => {
        if (err) return cb(err);

        if (!results || !results.length) {
          return cb(new Error('No routes for the given stop'), 'trips');
        }
        trip_ids = results;
        cb(null, 'trips');
      });
  }

  function getRoutes(cb) {
    Trip
      .distinct('route_id')
      .where('trip_id').in(trip_ids)
      .exec((err, results) => {
        if (err) return cb(err);

        if (!results || !results.length) {
          return cb(new Error('No routes for the given stop'), 'routes');
        }

        route_ids = results;
        return cb(null, 'routes');
      });
  }

  function lookupRoutes(cb) {
    Route
      .where('route_id').in(route_ids)
      .exec((err, results) => {
        if (err) return cb(err);

        if (!results || !results.length) {
          return cb(new Error('No information for routes'), 'lookup');
        }

        routes = results;
        return cb(null, 'lookup');
      });
  }
};
