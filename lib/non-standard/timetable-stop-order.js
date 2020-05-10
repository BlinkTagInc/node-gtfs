const utils = require('../utils');

const TimetableStopOrder = require('../../models/non-standard/timetable-stop-order');

/*
 * Returns an array of timetable_stop_orders that match the query parameters.
 */
exports.getTimetableStopOrders = (query = {}, projection = utils.defaultProjection, options = { lean: true, sort: { stop_sequence: 1 }, timeout: true }) => {
  return TimetableStopOrder.find(query, projection, options);
};
