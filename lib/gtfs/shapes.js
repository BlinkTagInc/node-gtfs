const _ = require('lodash');

const Shape = require('../../models/shape');
const Trip = require('../../models/trip');

/*
 * Returns an array of shapes for the `agencyKey`, `routeId` and
 * `directionId` specified
 */
exports.getShapesByRoute = (agencyKey, routeId, directionId, serviceIds, cb) => {
  if (_.isFunction(directionId)) {
    cb = directionId;
    directionId = undefined;
    serviceIds = undefined;
  }

  if (_.isFunction(serviceIds)) {
    cb = serviceIds;
    serviceIds = undefined;
  }

  return exports.getShapeIdsByRoute(agencyKey, routeId, directionId, serviceIds).then(results => {
    // Remove empty strings
    const shapeIds = _.compact(results);

    return exports.getShapesByShapeId(agencyKey, shapeIds);
  }).then(shapes => {
    if (cb) {
      return cb(null, shapes);
    }

    return shapes;
  }, cb);
};

/*
 * Returns an array of shape_ids for the `agencyKey`, `routeId` and
 * `directionId` specified
 */
exports.getShapeIdsByRoute = (agencyKey, routeId, directionId, serviceIds) => {
  const query = {
    agency_key: agencyKey,
    route_id: routeId
  };

  if (directionId !== undefined) {
    query.direction_id = directionId;
  } // else match all directionIds

  if (serviceIds && serviceIds.length > 0) {
    query.service_id = {
      $in: serviceIds
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
exports.getShapesByShapeId = (agencyKey, shapeIds) => {
  const shapes = [];

  return Promise.all(shapeIds.map(shapeId => {
    return Shape.find({
      agency_key: agencyKey,
      shape_id: shapeId
    })
    .sort({shape_pt_sequence: 1})
    .then(shapePts => {
      if (!shapePts || shapePts.length === 0) {
        throw (new Error('No shapes with shape_id.'));
      }

      shapes.push(shapePts);
    });
  })).then(() => {
    return shapes;
  });
};
