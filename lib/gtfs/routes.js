const _ = require('lodash');

const utils = require('../utils');

const Route = require('../../models/gtfs/route');
const Stop = require('../../models/gtfs/stop');
const StopTime = require('../../models/gtfs/stop-time');
const Trip = require('../../models/gtfs/trip');

const getRouteIdsWithinRadius = async query => {
  if (!query.within.lat || !query.within.lon) {
    throw new Error('`within` must contain `lat` and `lon`.');
  }

  let { lat, lon, radius } = query.within;
  if (radius === undefined) {
    radius = 1;
  }

  const stops = await Stop.find({}, utils.defaultProjection, { timeout: true })
    .near('loc', {
      center: [lon, lat],
      spherical: true,
      maxDistance: utils.milesToRadians(radius)
    });

  const stopIds = _.compact(_.map(stops, 'stop_id'));

  const tripIds = await StopTime.find({}, utils.defaultProjection, { timeout: true })
    .distinct('trip_id')
    .where('stop_id').in(stopIds);

  return Trip
    .distinct('route_id')
    .where('trip_id').in(tripIds);
};

const getRouteIdsByStopId = async query => {
  const tripIds = await StopTime.find({
    stop_id: query.stop_id
  }, utils.defaultProjection, { timeout: true })
    .distinct('trip_id');

  return Trip.find({}, utils.defaultProjection, { timeout: true })
    .distinct('route_id')
    .where('trip_id').in(tripIds);
};

/*
 * Returns an array of routes that match the query parameters. A `within`
 * parameter containing `lat`, `lon` and optionally `radius` in miles may be
 * passed to search for agencies in a specific area. A `stop_id` parameter
 * may be passed to find all routes that contain that stop.
 */
exports.getRoutes = async (query = {}, projection = utils.defaultProjection, options = { lean: true, timeout: true }) => {
  const routeQuery = _.omit(query, ['within', 'stop_id']);
  let routeIds;
  let radiusRouteIds;
  let stopRouteIds;

  if (query.within !== undefined) {
    radiusRouteIds = await getRouteIdsWithinRadius(query);
  }

  if (query.stop_id !== undefined) {
    stopRouteIds = await getRouteIdsByStopId(query);
  }

  if (radiusRouteIds && stopRouteIds) {
    routeIds = _.intersection([radiusRouteIds, stopRouteIds]);
  } else if (radiusRouteIds) {
    routeIds = radiusRouteIds;
  } else if (stopRouteIds) {
    routeIds = stopRouteIds;
  }

  if (routeIds) {
    routeQuery.route_id = { $in: routeIds };
  }

  return Route.find(routeQuery, projection, options);
};
