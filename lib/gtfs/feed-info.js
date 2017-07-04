const FeedInfo = require('../../models/feed-info');

/*
 * Returns feed_info for the agencyKey specified
 */
exports.getFeedInfo = agencyKey => {
  return FeedInfo.findOne({
    agency_key: agencyKey
  });
};
