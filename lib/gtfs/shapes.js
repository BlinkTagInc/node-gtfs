const _ = require('lodash');

const geojsonUtils = require('../geojson-utils');
const utils = require('../utils');

const Agency = require('../../models/gtfs/agency');
const Route = require('../../models/gtfs/route');
const Shape = require('../../models/gtfs/shape');
const Trip = require('../../models/gtfs/trip');

/*
 * Returns array of shapes that match the query parameters.
 */
exports.getShapes = async (query = {}, projection = utils.defaultProjection, options = { lean: true, sort: { shape_pt_sequence: 1 }, timeout: true }) => {
  const shapes = [];
  let shapeIds;

  if (_.isString(query.shape_id)) {
    shapeIds = [query.shape_id];
  } else if (_.isObject(query.shape_id) && query.shape_id.$in !== undefined) {
    shapeIds = query.shape_id.$in;
  } else {
    const tripQuery = {};

    if (query.agency_key !== undefined) {
      tripQuery.agency_key = query.agency_key;
    }

    if (query.route_id !== undefined) {
      tripQuery.route_id = query.route_id;
    }

    if (query.trip_id !== undefined) {
      tripQuery.trip_id = query.trip_id;
    }

    if (query.direction_id !== undefined) {
      tripQuery.direction_id = query.direction_id;
    }

    if (query.service_id !== undefined) {
      tripQuery.service_id = query.service_id;
    }

    shapeIds = await Trip.find(tripQuery, utils.defaultProjection, { timeout: true }).distinct('shape_id');
  }

  await Promise.all(shapeIds.sort().map(async shapeId => {
    const shapeQuery = {
      shape_id: shapeId,
      ..._.omit(query, ['route_id', 'trip_id', 'direction_id', 'service_id'])
    };
    const shapePoints = await Shape.find(shapeQuery, projection, options);

    if (shapePoints.length > 0) {
      shapes.push(shapePoints);
    }
  }));

  return shapes;
};

/*
 * Returns geoJSON of the shapes that match the query parameters.
 */
exports.getShapesAsGeoJSON = async (query = {}) => {
  const properties = {};

  if (query.agency_key === 'undefined') {
    throw new Error('`agency_key` is a required parameter.');
  }

  const agency = await Agency.findOne({
    agency_key: query.agency_key
  });
  properties.agency_name = agency ? agency.agency_name : '';
  properties.agency_key = agency ? agency.agency_key : '';

  const routeQuery = {
    agency_key: query.agency_key
  };

  if (query.route_id !== undefined) {
    routeQuery.route_id = query.route_id;
  }

  if (query.direction_id !== undefined) {
    properties.direction_id = query.direction_id;
  }

  const routes = await Route.find(routeQuery, utils.defaultProjection, { timeout: true }).lean();
  const features = [];

  await Promise.all(routes.map(async route => {
    const shapeQuery = { ...{ route_id: route.route_id }, ..._.omit(query, 'route_id') };
    const shapes = await exports.getShapes(shapeQuery);
    const routeProperties = { ...properties, ...route };
    features.push(...geojsonUtils.shapesToGeoJSONFeatures(shapes, routeProperties));
  }));

  return geojsonUtils.featuresToGeoJSON(features);
};
