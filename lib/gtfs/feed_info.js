const FeedInfo = require('../../models/FeedInfo');

/*
 * Returns feed_info for the agency_key specified
 */
exports.getFeedInfo = (agency_key, cb) => {
  return FeedInfo.findOne({
    agency_key
  }).exec(cb);
};
