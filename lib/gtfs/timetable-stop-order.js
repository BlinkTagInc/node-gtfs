const TimetableStopOrder = require('../../models/timetable-stop-order');

/*
 * Returns an array of timetable_stop_order objects matching the
 * `timetableId` specified
 */
exports.getTimetableStopOrders = (agencyKey, timetableId) => {
  return TimetableStopOrder.find({
    agency_key: agencyKey,
    timetable_id: timetableId
  }, null, {
    sort: 'stop_sequence'
  });
};
