const TimetableStopOrder = require('../../models/timetable-stop-order');

/*
 * Returns an array of timetable_stop_orders that match the query parameters.
 */
exports.getTimetableStopOrders = query => {
  return TimetableStopOrder.find(query).sort('stop_sequence');
};
