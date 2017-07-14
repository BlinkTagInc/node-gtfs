const _ = require('lodash');

const utils = require('../utils');

const Route = require('../../models/route');
const Stop = require('../../models/stop');
const StopTime = require('../../models/stop-time');
const Trip = require('../../models/trip');

function getRouteIdsWithinRadius(query) {
  return Promise.resolve()
  .then(() => {
    if (!query.within.lat || !query.within.lon) {
      throw new Error('`within` must contain `lat` and `lon`.');
    }

    let {lat, lon, radius} = query.within;
    if (radius === undefined) {
      radius = 1;
    }

    return Stop
    .where('loc')
    .near(lon, lat).maxDistance(utils.milesToDegrees(radius));
  })
  .then(stops => {
    const stopIds = stops.reduce((memo, stop) => {
      if (stop.stop_id) {
        memo.push(stop.stop_id);
      }
      return memo;
    }, []);

    return StopTime
    .distinct('trip_id')
    .where('stop_id').in(stopIds);
  })
  .then(tripIds => {
    return Trip
    .distinct('route_id')
    .where('trip_id').in(tripIds);
  });
}

function getRouteIdsByStopId(query) {
  return StopTime
  .find({
    stop_id: query.stop_id
  })
  .distinct('trip_id')
  .then(tripIds => {
    return Trip
    .distinct('route_id')
    .where('trip_id').in(tripIds);
  });
}

/*
 * Returns an array of routes that match the query parameters. A `within`
 * parameter containing `lat`, `lon` and optionally `radius` in miles may be
 * passed to search for agencies in a specific area. A `stop_id` parameter
 * may be passed to find all routes that contain that stop.
 */
exports.getRoutes = async (query = {}) => {
  let routeIds;
  let radiusRouteIds;
  let stopRouteIds;

  if (query.within !== undefined) {
    radiusRouteIds = await getRouteIdsWithinRadius(query);
    delete query.within;
  }

  if (query.stop_id !== undefined) {
    stopRouteIds = await getRouteIdsByStopId(query);
    delete query.stop_id;
  }

  if (radiusRouteIds && stopRouteIds) {
    routeIds = _.intersection([radiusRouteIds, stopRouteIds]);
  } else if (radiusRouteIds) {
    routeIds = radiusRouteIds;
  } else if (stopRouteIds) {
    routeIds = stopRouteIds;
  }

  if (routeIds) {
    query.route_id = {$in: routeIds};
  }

  return Route.find(query);
};
