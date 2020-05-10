const utils = require('../utils');

const FeedInfo = require('../../models/gtfs/feed-info');

/*
 * Returns an array of feed_info that match the query parameters.
 */
exports.getFeedInfo = (query = {}, projection = utils.defaultProjection, options = { lean: true, timeout: true }) => {
  return FeedInfo.find(query, projection, options);
};
