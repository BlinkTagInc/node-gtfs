const utils = require('../utils');

const Agency = require('../../models/agency');

/*
 * Returns an array of all agencies
 */
exports.agencies = () => Agency.find({});

/*
 * Returns an agency
 */
exports.getAgency = (agencyKey, agencyId) => {
  const query = {
    agency_key: agencyKey
  };

  if (agencyId !== undefined) {
    query.agency_id = agencyId;
  }

  return Agency.findOne(query);
};

/*
 * Returns an array of agencies within a `radius` of the `lat`, `lon` specified.
 * Default `radius` is 25 miles.
 */
exports.getAgenciesByDistance = (lat, lon, radius = 25) => {
  return Agency
  .where('agency_center')
  .near(parseFloat(lon), parseFloat(lat))
  .maxDistance(utils.milesToDegrees(radius));
};
