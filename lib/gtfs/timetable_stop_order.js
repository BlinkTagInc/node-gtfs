const TimetableStopOrder = require('../../models/TimetableStopOrder');

/*
 * Returns an array of timetable_stop_order objects matching the
 * `timetable_id` specified
 */
exports.getTimetableStopOrders = (agency_key, timetable_id, cb) => {
  return TimetableStopOrder.find({
    agency_key,
    timetable_id
  }, null, {
    sort: 'stop_sequence'
  }).exec(cb);
};
