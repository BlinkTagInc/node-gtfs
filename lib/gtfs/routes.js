const _ = require('lodash');
const utils = require('../utils');

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
    radius = 1; // Default is 1 mile
  }

  lat = parseFloat(lat);
  lon = parseFloat(lon);

  return Stop
  .where('loc')
  .near(lon, lat).maxDistance(utils.milesToDegrees(radius))
  .then(stops => {
    if (stops.length > 0) {
      return stops.reduce((memo, stop) => {
        if (stop.stop_id) {
          memo.push(stop.stop_id);
        }
        return memo;
      }, []);
    }
    return [];
  })
  .then(stopIds => {
    return StopTime
    .distinct('trip_id')
    .where('stop_id').in(stopIds);
  })
  .then(tripIds => {
    return Trip
    .distinct('route_id')
    .where('trip_id').in(tripIds);
  })
  .then(routeIds => {
    return Route
    .where('route_id').in(routeIds)
    .exec(cb);
  });
};

/*
 * Returns an array of routes serving the `agencyKey` and `stop_id` specified
 */
exports.getRoutesByStop = (agencyKey, stopId, cb) => {
  return StopTime
  .find({
    agency_key: agencyKey,
    stop_id: stopId
  })
  .distinct('trip_id')
  .then(tripIds => {
    return Trip
    .distinct('route_id')
    .where('trip_id').in(tripIds);
  })
  .then(routeIds => {
    return Route
    .where('route_id').in(routeIds)
    .exec(cb);
  });
};
