const _ = require('lodash');
const utils = require('../utils');

const Agency = require('../../models/Agency');

/*
 * Returns an array of all agencies
 */
exports.agencies = (cb) => {
  return Agency.find({}).exec(cb);
};


/*
 * Returns an agency
 */
exports.getAgency = (agency_key, agency_id, cb) => {
  if (_.isFunction(agency_id)) {
    cb = agency_id;
    agency_id = undefined;
  }

  const query = {
    agency_key
  };

  if (agency_id !== undefined) {
    query.agency_id = agency_id;
  }

  return Agency.findOne(query).exec(cb);
};


/*
 * Returns an array of agencies within a `radius` of the `lat`, `lon` specified
 */
exports.getAgenciesByDistance = (lat, lon, radius, cb) => {
  if (_.isFunction(radius)) {
    cb = radius;
    radius = 25; // default is 25 miles
  }

  return Agency
    .where('agency_center')
    .near(parseFloat(lon), parseFloat(lat))
    .maxDistance(utils.milesToDegrees(radius))
    .exec(cb);
};
