const utils = require('../utils');

const Agency = require('../../models/agency');

/*
 * Returns an array of all agencies that match the query parameters. A `within`
 * parameter containing `lat`, `lon` and optionally `radius` in miles may be
 * passed to search for agencies in a specific area.
 */
exports.getAgencies = (query = {}) => {
  if (query.within !== undefined) {
    return Promise.resolve()
    .then(() => {
      if (!query.within.lat || !query.within.lon) {
        throw new Error('`within` must contain `lat` and `lon`.');
      }

      let {lat, lon, radius} = query.within;
      if (radius === undefined) {
        radius = 25;
      }
      delete query.within;

      return Agency.find(query)
      .where('agency_center')
      .near(lon, lat)
      .maxDistance(utils.milesToDegrees(radius));
    });
  }

  return Agency.find(query);
};
