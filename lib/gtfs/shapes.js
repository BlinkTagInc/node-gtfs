const _ = require('lodash');

const geojsonUtils = require('../geojson-utils');

const Agency = require('../../models/agency');
const Route = require('../../models/route');
const Shape = require('../../models/shape');
const Trip = require('../../models/trip');

/*
 * Returns an array of shapes for the `agencyKey` specified
 */
exports.getShapes = agencyKey => {
  return Trip.find({agency_key: agencyKey}).distinct('shape_id')
  .then(shapeIds => _.compact(shapeIds))
  .then(shapeIds => exports.getShapesByShapeId(agencyKey, shapeIds));
};

/*
 * Returns geoJSON of the shapes for the `agencyKey`specified
 */
exports.getShapesAsGeoJSON = agencyKey => {
  const agencyProperties = {};

  return Agency.findOne({
    agency_key: agencyKey
  })
  .then(agency => {
    agencyProperties.agency_name = agency ? agency.agency_name : '';
    agencyProperties.agency_key = agencyKey;

    return Route.find({
      agency_key: agencyKey
    }).select({_id: 0});
  })
  .then(routes => {
    return Promise.all(routes.map(route => {
      const properties = Object.assign(route.toObject(), agencyProperties);

      return exports.getShapesByRoute(agencyKey, route.route_id)
      .then(shapes => geojsonUtils.shapesToGeoJSONFeatures(shapes, properties));
    }));
  })
  .then(features => _.flatten(features))
  .then(features => geojsonUtils.featuresToGeoJSON(features));
};

/*
 * Returns an array of shapes for the `agencyKey`, `routeId` and
 * `directionId` specified
 */
exports.getShapesByRoute = (agencyKey, routeId, directionId, serviceIds) => {
  return exports.getShapeIdsByRoute(agencyKey, routeId, directionId, serviceIds)
  .then(shapeIds => _.compact(shapeIds))
  .then(shapeIds => exports.getShapesByShapeId(agencyKey, shapeIds));
};

/*
 * Returns geoJSON of the shapes for the `agencyKey`, `routeId` and
 * `directionId` specified
 */
exports.getShapesByRouteAsGeoJSON = (agencyKey, routeId, directionId, serviceIds) => {
  const properties = {
    direction_id: directionId
  };

  return Agency.findOne({
    agency_key: agencyKey
  })
  .then(agency => {
    properties.agency_name = agency ? agency.agency_name : '';
    properties.agency_key = agencyKey;

    return Route.findOne({
      agency_key: agencyKey,
      route_id: routeId
    }).select({_id: 0});
  })
  .then(route => {
    Object.assign(properties, route.toObject());

    return exports.getShapesByRoute(agencyKey, routeId, directionId, serviceIds);
  })
  .then(shapes => geojsonUtils.shapesToGeoJSONFeatures(shapes, properties))
  .then(features => geojsonUtils.featuresToGeoJSON(features));
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

  // Use directionId if specified, else match all directionIds
  if (directionId !== undefined) {
    query.direction_id = directionId;
  }

  if (serviceIds && serviceIds.length > 0) {
    query.service_id = {
      $in: serviceIds
    };
  }

  return Trip
  .find(query)
  .distinct('shape_id')
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
        throw (new Error(`No shapes with shape_id ${shapeId}.`));
      }

      shapes.push(shapePts);
    });
  })).then(() => shapes);
};
