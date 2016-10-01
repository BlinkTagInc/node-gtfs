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
    direction_id = null;
    service_ids = null;
  }

  if (_.isFunction(service_ids)) {
    cb = service_ids;
    service_ids = null;
  }

  let shape_ids;
  const shapes = [];

  async.series([getShapeIds, getShapes], () => {
    cb(null, shapes);
  });

  function getShapeIds(cb) {
    const query = {
      agency_key,
      route_id
    };
    if (direction_id !== null && direction_id !== undefined) {
      query.direction_id = direction_id;
    } // else match all direction_ids

    if (service_ids && service_ids.length) {
      query.service_id = {
        $in: service_ids
      };
    }

    Trip
      .find(query)
      .distinct('shape_id', function(err, results) {
        if (err) return cb(err);

        if (!results || !results.length) {
          return cb(new Error('No trips with shapes.'), 'trips');
        }

        // Remove empty strings
        shape_ids = _.compact(results);

        return cb(null, 'shape_ids');
      });
  }

  function getShapes(cb) {
    async.forEach(shape_ids, (shape_id, cb) => {
      Shape.find({
        agency_key,
        shape_id
      }).sort({'shape_pt_sequence': 1})
      .exec((err, shape_pts) => {
        if (err) return cb(err);

        if (!shape_pts || !shape_pts.length) {
          return cb(new Error('No shapes with shape_id.'), 'shape_pts');
        }

        shapes.push(shape_pts);
        return cb(null, 'shape_pts');
      });
    }, function() {
      cb(null, 'shapes');
    });
  }
};
