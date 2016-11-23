const _ = require('lodash');

const Trip = require('../../models/Trip');

/*
 * Returns an array of trips for the `agency_key`, `route_id` and
 * `direction_id` specified
 */
exports.getTripsByRouteAndDirection = (agency_key, route_id, direction_id, service_ids, cb) => {
  if (_.isFunction(service_ids)) {
    cb = service_ids;
    service_ids = undefined;
  }

  const query = {
    agency_key,
    route_id
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

  return Trip.find(query).exec(cb);
};
