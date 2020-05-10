const _ = require('lodash');

const utils = require('../utils');

const Agency = require('../../models/gtfs/agency');

/*
 * Returns an array of all agencies that match the query parameters. A `within`
 * parameter containing `lat`, `lon` and optionally `radius` in miles may be
 * passed to search for agencies in a specific area.
 */
exports.getAgencies = (query = {}, projection = utils.defaultProjection, options = { lean: true, timeout: true }) => {
  if (query.within !== undefined) {
    if (!query.within.lat || !query.within.lon) {
      throw new Error('`within` must contain `lat` and `lon`.');
    }

    let { lat, lon, radius } = query.within;
    if (radius === undefined) {
      radius = 25;
    }

    return Agency.find(_.omit(query, 'within'), projection, options)
      .near('agency_center', {
        center: [lon, lat],
        spherical: true,
        maxDistance: utils.milesToRadians(radius)
      });
  }

  return Agency.find(query, projection, options);
};
