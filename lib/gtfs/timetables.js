const Timetable = require('../../models/Timetable');

/*
 * Returns an array of timetables for the `agency_key` specified
 */
exports.getTimetablesByAgency = (agency_key, cb) => {
  return Timetable.find({
    agency_key
  }).exec(cb);
};


/*
 * Returns an array timetable objects matching the `timetable_id` specified
 */
exports.getTimetable = (agency_key, timetable_id, cb) => {
  return Timetable.find({
    agency_key,
    timetable_id
  }).exec(cb);
};
