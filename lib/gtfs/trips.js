const utils = require('../utils');

const Trip = require('../../models/gtfs/trip');
const StopTime = require('../../models/gtfs/stop-time');

/*
 * Returns an array of trips that match the query parameters.
 */
exports.getTrips = (query = {}, projection = utils.defaultProjection, options = { lean: true, timeout: true }) => {
  return Trip.find(query, projection, options);
};

exports.getTripsByStopId = async (query = {}) => {

  if (query.agency_key === 'undefined') {
    throw new Error('`agency_key` is a required parameter.');
  }

  if (query.stop_id === 'undefined') {
    throw new Error('`stop_id` is a required parameter.');
  }

  return await StopTime.find({}, utils.defaultProjection, { timeout: true })
    .distinct('trip_id')
    .where('stop_id')
    .in(stopIds);
};

/*
 * Returns an array of directions for an `agency_key` and `route_id` specified.
 */
exports.getDirectionsByRoute = async (query = {}) => {
  if (query.agency_key === 'undefined') {
    throw new Error('`agency_key` is a required parameter.');
  }

  if (query.route_id === 'undefined') {
    throw new Error('`route_id` is a required parameter.');
  }

  const directions = await Trip.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          trip_headsign: '$trip_headsign',
          direction_id: '$direction_id'
        }
      }
    }
  ]);

  return directions.map(direction => ({
    route_id: query.route_id,
    trip_headsign: direction._id.trip_headsign,
    direction_id: direction._id.direction_id
  }));
};
