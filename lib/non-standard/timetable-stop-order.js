const TimetableStopOrder = require('../../models/non-standard/timetable-stop-order');

/*
 * Returns an array of timetable_stop_orders that match the query parameters.
 */
exports.getTimetableStopOrders = (query = {}, projection = '-_id', options = {lean: true, sort: {stop_sequence: 1}}) => {
  return TimetableStopOrder.find(query, projection, options);
};
