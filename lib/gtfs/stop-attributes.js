const _ = require('lodash');

const StopAttributes = require('../../models/stop-attributes');

/*
 * Returns an array of stop attributes for the `agencyKey` specified,
 * optionally limited to the `stopIds` specified
 */
exports.getStopAttributes = (agencyKey, stopIds) => {
  const query = {
    agency_key: agencyKey
  };

  if (stopIds !== undefined) {
    if (!_.isArray(stopIds)) {
      stopIds = [stopIds];
    }

    query.stop_id = {
      $in: stopIds
    };
  }

  return StopAttributes.find(query);
};
