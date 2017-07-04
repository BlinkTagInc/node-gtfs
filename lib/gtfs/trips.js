const _ = require('lodash');

const Trip = require('../../models/trip');

/*
 * Returns an array of trips for the `agencyKey`, `routeId` and
 * `direction_id` specified
 */
exports.getTripsByRouteAndDirection = (agencyKey, routeId, direction_id, service_ids) => {
  const query = {
    agency_key: agencyKey,
    route_id: routeId
  };

  if (_.includes([0, 1], direction_id)) {
    query.direction_id = direction_id;
  } else {
    query.direction_id = {
      $nin: [0, 1]
    };
  }

  if (service_ids && service_ids.length) {
    query.service_id = {
      $in: service_ids
    };
  }

  return Trip.find(query);
};

/*
 * Returns an array of directions for the `agencyKey` and `routeId` specified
 */
exports.getDirectionsByRoute = (agencyKey, routeId, service_ids) => {
  const query = {
    agency_key: agencyKey,
    route_id: routeId
  };

  if (service_ids && service_ids.length) {
    query.service_id = {
      $in: service_ids
    };
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
    route_id: routeId,
    trip_headsign: direction._id.trip_headsign,
    direction_id: direction._id.direction_id
  })));
};
