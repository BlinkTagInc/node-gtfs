const utils = require('../utils');

const Route = require('../../models/route');
const Stop = require('../../models/stop');
const StopTime = require('../../models/stop-time');
const Trip = require('../../models/trip');

/*
 * Returns an array of routes for the `agencyKey` specified and `agencyId`
 * if specified
 */
exports.getRoutesByAgency = (agencyKey, agencyId) => {
  const query = {
    agency_key: agencyKey
  };

  if (agencyId !== undefined) {
    query.agency_id = agencyId;
  }

  return Route.find(query);
};

/*
 * Returns a route for the `routeId` specified
 */
exports.getRoutesById = (agencyKey, routeId) => {
  return Route.findOne({
    agency_key: agencyKey,
    route_id: routeId
  });
};

/*
 * Returns an array of routes within a `radius` of the `lat`, `lon` specified.
 * Default `radius` is 1 mile
 */
exports.getRoutesByDistance = (lat, lon, radius = 1) => {
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
  .then(routeIds => Route.where('route_id').in(routeIds));
};

/*
 * Returns an array of routes serving the `agencyKey` and `stop_id` specified
 */
exports.getRoutesByStop = (agencyKey, stopId) => {
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
  .then(routeIds => Route.where('route_id').in(routeIds));
};
