const Trip = require('../../models/trip');

/*
 * Returns an array of trips that match the query parameters.
 */
exports.getTrips = query => Trip.find(query);

/*
 * Returns an array of directions for an `agency_key` and `route_id` specified.
 */
exports.getDirectionsByRoute = (query = {}) => {
  return Promise.resolve()
  .then(() => {
    if (query.agency_key === 'undefined') {
      throw new Error('`agency_key` is a required parameter.');
    }
    if (query.route_id === 'undefined') {
      throw new Error('`route_id` is a required parameter.');
    }

    return Trip.aggregate([
      {$match: query},
      {
        $group: {
          _id: {
            trip_headsign: '$trip_headsign',
            direction_id: '$direction_id'
          }
        }
      }
    ])
    .then(results => results.map(direction => ({
      route_id: query.route_id,
      trip_headsign: direction._id.trip_headsign,
      direction_id: direction._id.direction_id
    })));
  });
};
