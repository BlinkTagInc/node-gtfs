const Timetable = require('../../models/timetable');

/*
 * Returns an array of timetables for the `agencyKey` specified
 */
exports.getTimetablesByAgency = (agencyKey, cb) => {
  return Timetable.find({
    agency_key: agencyKey
  }).exec(cb);
};

/*
 * Returns an array timetable objects matching the `timetableId` specified
 */
exports.getTimetable = (agencyKey, timetableId, cb) => {
  return Timetable.find({
    agency_key: agencyKey,
    timetable_id: timetableId
  }).exec(cb);
};
