const _ = require('lodash');
const async = require('async');

const Shape = require('../../models/Shape');
const Trip = require('../../models/Trip');

/*
 * Returns an array of shapes for the `agency_key`, `route_id` and
 * `direction_id` specified
 */
exports.getShapesByRoute = (agency_key, route_id, direction_id, service_ids, cb) => {
  if (_.isFunction(direction_id)) {
    cb = direction_id;
    direction_id = undefined;
    service_ids = undefined;
  }

  if (_.isFunction(service_ids)) {
    cb = service_ids;
    service_ids = undefined;
  }

  return exports.getShapeIdsByRoute(agency_key, route_id, direction_id, service_ids).then((results) => {
    // Remove empty strings
    const shape_ids = _.compact(results);

    return exports.getShapesByShapeId(agency_key, shape_ids);
  }).then((shapes) => {
    if (cb) {
      return cb(null, shapes);
    }

    return shapes;
  }, cb);
};


/*
 * Returns an array of shape_ids for the `agency_key`, `route_id` and
 * `direction_id` specified
 */
exports.getShapeIdsByRoute = (agency_key, route_id, direction_id, service_ids) => {
  const query = {
    agency_key,
    route_id
  };

  if (direction_id !== undefined) {
    query.direction_id = direction_id;
  } // else match all direction_ids

  if (service_ids && service_ids.length) {
    query.service_id = {
      $in: service_ids
    };
  }

  return Trip
    .find(query)
    .distinct('shape_id')
    .exec();
};


/*
 * Returns an array of shapes for the `shape_ids` specified
 */
exports.getShapesByShapeId = (agency_key, shape_ids) => {
  const shapes = [];

  return Promise.all(shape_ids.map((shape_id) => {
    return Shape.find({
      agency_key,
      shape_id
    })
    .sort({'shape_pt_sequence': 1})
    .then((shape_pts) => {
      if (!shape_pts || !shape_pts.length) {
        throw (new Error('No shapes with shape_id.'));
      }

      shapes.push(shape_pts);
    });
  })).then(() => {
    return shapes
  });
}
