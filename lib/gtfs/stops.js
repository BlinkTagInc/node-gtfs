const _ = require('lodash');
const utils = require('../utils');
const geojsonUtils = require('../geojson-utils');

const Agency = require('../../models/gtfs/agency');
const Route = require('../../models/gtfs/route');
const Stop = require('../../models/gtfs/stop');
const StopTime = require('../../models/gtfs/stop-time');
const Trip = require('../../models/gtfs/trip');

const stopsToGeoJSON = async stops => {
  // Get all agencies for reference
  const results = await Agency.find({}).lean();
  const agencies = results.reduce((memo, agency) => {
    memo[agency.agency_key] = agency;
    return memo;
  }, {});

  const preparedStops = await Promise.all(stops.map(async stop => {
    const agency = agencies[stop.agency_key];
    stop.agency_name = agency.agency_name;

    const tripIds = await StopTime.find({
      agency_key: stop.agency_key,
      stop_id: stop.stop_id
    })
      .distinct('trip_id');

    const routeIds = await Trip.find({
      agency_key: stop.agency_key
    })
      .distinct('route_id')
      .where('trip_id').in(tripIds);

    const routes = await Route.find({
      agency_key: stop.agency_key
    })
      .where('route_id').in(routeIds)
      .select({_id: 0, agency_key: 0, agency_id: 0, route_type: 0})
      .lean();

    stop.routes = _.orderBy(routes, route => parseInt(route.route_short_name, 10));

    return stop;
  }));

  return geojsonUtils.featuresToGeoJSON(geojsonUtils.stopsToGeoJSONFeatures(preparedStops));
};

/*
 * Returns an array of stops that match the query parameters. A `within`
 * parameter containing `lat`, `lon` and optionally `radius` in miles may be
 * passed to search for agencies in a specific area.
 */
exports.getStops = async (query = {}, projection = '-_id', options = {lean: true}) => {
  if (query.route_id !== undefined) {
    if (query.agency_key === 'undefined') {
      throw new Error('`agency_key` is a required parameter if `route_id` is specified.');
    }

    const tripQuery = {
      agency_key: query.agency_key,
      route_id: query.route_id
    };

    if (query.direction_id !== undefined) {
      tripQuery.direction_id = query.direction_id;
    }

    const trips = await Trip.find(tripQuery).select({trip_id: 1, direction_id: 1});

    if (trips.length === 0) {
      return [];
    }

    const stoptimesList = [];

    for (const trip of trips) {
      const stoptimes = await StopTime.find({
        agency_key: query.agency_key,
        trip_id: trip.trip_id
      })
        .sort('stop_sequence')
        .select({stop_sequence: 1, stop_id: 1});

      stoptimesList.push(stoptimes);
    }

    const sortedStoptimes = _.flatten(_.sortBy(stoptimesList, stoptimes => {
      return stoptimes.length;
    }));

    // Get a distinct list of stops
    const distinctStoptimes = sortedStoptimes.reduce((memo, stoptime) => {
      memo[stoptime.stop_id] = stoptime;
      return memo;
    }, {});

    // Order stops by stop_sequence
    const stopIds = _.sortBy(distinctStoptimes, stoptime => stoptime.stop_sequence).map(stoptime => stoptime.stop_id);

    query.stop_id = {$in: stopIds};
    delete query.route_id;
    delete query.direction_id;
  }

  if (query.within !== undefined) {
    if (!query.within.lat || !query.within.lon) {
      throw new Error('`within` must contain `lat` and `lon`.');
    }

    let {lat, lon, radius} = query.within;
    if (radius === undefined) {
      radius = 1;
    }
    delete query.within;

    return Stop.find(query, projection, options)
      .near('loc', {
        center: [lon, lat],
        spherical: true,
        maxDistance: utils.milesToRadians(radius)
      });
  }

  return Stop.find(query, projection, options);
};

/*
 * Returns geoJSON with stops for the `agencyKey` specified, optionally limited
 * to the `stopIds` specified
 */
exports.getStopsAsGeoJSON = async (query = {}) => {
  const stops = await exports.getStops(query);
  return stopsToGeoJSON(stops);
};
