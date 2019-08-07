const Transfer = require('../../models/gtfs/transfer');

/*
 * Returns an array of transfers that match the query parameters.
 */
exports.getTransfers = (query = {}, projection = '-_id -created_at', options = {lean: true, timeout: true}) => {
  return Transfer.find(query, projection, options);
};
