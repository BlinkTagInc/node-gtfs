const _ = require('lodash');
const utils = require('../utils');

const Agency = require('../../models/agency');

/*
 * Returns an array of all agencies
 */
exports.agencies = cb => {
  return Agency.find({}).exec(cb);
};

/*
 * Returns an agency
 */
exports.getAgency = (agencyKey, agencyId, cb) => {
  if (_.isFunction(agencyId)) {
    cb = agencyId;
    agencyId = undefined;
  }

  const query = {
    agency_key: agencyKey
  };

  if (agencyId !== undefined) {
    query.agency_id = agencyId;
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
