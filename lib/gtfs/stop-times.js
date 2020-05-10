const _ = require('lodash');
const utils = require('../utils');

const StopTime = require('../../models/gtfs/stop-time');
const Trip = require('../../models/gtfs/trip');

/*
 * Returns an array of stoptimes that match the query parameters.
 */
exports.getStoptimes = async (query = {}, projection = utils.defaultProjection, options = { lean: true, sort: { stop_sequence: 1 }, timeout: true }) => {
  if (query.agency_key === 'undefined') {
    throw new Error('`agency_key` is a required parameter.');
  }

  const stoptimeQuery = _.omit(query, ['service_id', 'route_id', 'direction_id']);

  if (query.trip_id === undefined) {
    const tripQuery = {
      agency_key: query.agency_key
    };

    if (query.service_id !== undefined) {
      tripQuery.service_id = query.service_id;
    }

    if (query.route_id !== undefined) {
      tripQuery.route_id = query.route_id;
    }

    if (query.direction_id !== undefined) {
      tripQuery.direction_id = query.direction_id;
    }

    const tripIds = await Trip.find(tripQuery, utils.defaultProjection, { timeout: true }).distinct('trip_id');

    stoptimeQuery.trip_id = {
      $in: tripIds
    };
  }

  return StopTime.find(stoptimeQuery, projection, options);
};
