const StopTime = require('../../models/stop-time');
const Trip = require('../../models/trip');

/*
 * Returns an array of stoptimes that match the query parameters.
 */
exports.getStoptimes = async (query = {}) => {
  if (query.agency_key === 'undefined') {
    throw new Error('`agency_key` is a required parameter.');
  }

  if (query.trip_id === undefined) {
    const tripQuery = {
      agency_key: query.agency_key
    };

    if (query.service_id !== undefined) {
      tripQuery.service_id = query.service_id;
      delete query.service_id;
    }

    if (query.route_id !== undefined) {
      tripQuery.route_id = query.route_id;
      delete query.route_id;
    }

    if (query.direction_id !== undefined) {
      tripQuery.direction_id = query.direction_id;
      delete query.direction_id;
    }

    const tripIds = await Trip.find(tripQuery).distinct('trip_id');

    query.trip_id = {
      $in: tripIds
    };
  }

  return StopTime.find(query, '-_id').sort({stop_sequence: 1}).lean();
};
