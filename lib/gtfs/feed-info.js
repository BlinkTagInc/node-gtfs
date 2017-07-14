const FeedInfo = require('../../models/feed-info');

/*
 * Returns an array of feed_info that match the query parameters.
 */
exports.getFeedInfo = query => FeedInfo.find(query);
