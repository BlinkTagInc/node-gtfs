const _ = require('lodash');
const async = require('async');

const Route = require('../../models/route');
const Stop = require('../../models/stop');
const StopTime = require('../../models/stop-time');
const Trip = require('../../models/trip');

/*
 * Returns an array of routes for the `agencyKey` specified and `agencyId`
 * if specified
 */
exports.getRoutesByAgency = (agencyKey, agencyId, cb) => {
  if (_.isFunction(agencyId)) {
    cb = agencyId;
    agencyId = undefined;
  }

  const query = {
    agency_key: agencyKey
  };

  if (agencyId !== undefined) {
    query.agency_id = agencyId;
  }

  return Route.find(query).exec(cb);
};

/*
 * Returns a route for the `routeId` specified
 */
exports.getRoutesById = (agencyKey, routeId, cb) => {
  return Route.findOne({
    agency_key: agencyKey,
    route_id: routeId
  }).exec(cb);
};

/*
 * Returns an array of routes within a `radius` of the `lat`, `lon` specified
 */
exports.getRoutesByDistance = (lat, lon, radius, cb) => {
  if (_.isFunction(radius)) {
    cb = radius;
    radius = 1; // default is 1 mile
  }

  lat = parseFloat(lat);
  lon = parseFloat(lon);

  const radiusInDegrees = Math.round(radius / 69 * 100000) / 100000;
  let stopIds;
  let tripIds;
  let routeIds;
  let routes;

  async.series([
    getStopsNearby,
    getTrips,
    getRoutes,
    lookupRoutes
  ], err => {
    cb(err, routes);
  });

  function getStopsNearby(cb) {
    Stop
      .where('loc')
      .near(lon, lat).maxDistance(radiusInDegrees)
      .exec()
      .then(stops => {
        if (stops.length > 0) {
          stopIds = stops.reduce((memo, stop) => {
            if (stop.stop_id) {
              memo.push(stop.stop_id);
            }
            return memo;
          }, []);
        }
        cb();
      })
      .catch(cb);
  }

  function getTrips(cb) {
    StopTime
      .distinct('trip_id')
      .where('stop_id').in(stopIds)
      .exec()
      .then(results => {
        tripIds = results;
        cb();
      })
      .catch(cb);
  }

  function getRoutes(cb) {
    Trip
      .distinct('route_id')
      .where('trip_id').in(tripIds)
      .exec()
      .then(results => {
        routeIds = results;
        cb();
      })
      .catch(cb);
  }

  function lookupRoutes(cb) {
    Route
      .where('route_id').in(routeIds)
      .exec()
      .then(results => {
        routes = results;
        cb();
      })
      .catch(cb);
  }
};

/*
 * Returns an array of routes serving the `agencyKey` and `stop_id` specified
 */
exports.getRoutesByStop = (agencyKey, stop_id, cb) => {
  let tripIds;
  let routeIds;
  let routes;

  async.series([
    getTrips,
    getRoutes,
    lookupRoutes
  ], err => {
    cb(err, routes);
  });

  function getTrips(cb) {
    StopTime
      .find({
        agency_key: agencyKey,
        stop_id: stop_id
      })
      .distinct('trip_id')
      .exec()
      .then(results => {
        if (!results || results.length === 0) {
          throw new Error('No routes for the given stop');
        }
        tripIds = results;
        cb();
      })
      .catch(cb);
  }

  function getRoutes(cb) {
    Trip
      .distinct('route_id')
      .where('trip_id').in(tripIds)
      .exec()
      .then(results => {
        if (!results || results.length === 0) {
          throw new Error('No routes for the given stop');
        }
        routeIds = results;
        cb();
      })
      .catch(cb);
  }

  function lookupRoutes(cb) {
    Route
      .where('route_id').in(routeIds)
      .exec()
      .then(results => {
        if (!results || results.length === 0) {
          throw new Error('No information for routes');
        }

        routes = results;
        cb();
      })
      .catch(cb);
  }
};
