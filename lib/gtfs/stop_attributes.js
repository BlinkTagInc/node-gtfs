const _ = require('lodash');

const StopAttributes = require('../../models/StopAttributes');

/*
 * Returns an array of stop attributes for the `agency_key` specified,
 * optionally limited to the `stop_ids` specified
 */
exports.getStopAttributes = (agency_key, stop_ids, cb) => {
  if (_.isFunction(stop_ids)) {
    cb = stop_ids;
    stop_ids = undefined;
  }

  const query = {
    agency_key
  };

  if (stop_ids !== undefined) {
    if (!_.isArray(stop_ids)) {
      stop_ids = [stop_ids];
    }

    query.stop_id = {
      $in: stop_ids
    };
  }

  return StopAttributes.find(query).exec(cb);
};
