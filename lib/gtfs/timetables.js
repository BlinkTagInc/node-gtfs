const Timetable = require('../../models/timetable');

/*
 * Returns an array of timetables for the `agencyKey` specified
 */
exports.getTimetablesByAgency = agencyKey => {
  return Timetable.find({
    agency_key: agencyKey
  });
};

/*
 * Returns an array timetable objects matching the `timetableId` specified
 */
exports.getTimetable = (agencyKey, timetableId) => {
  return Timetable.find({
    agency_key: agencyKey,
    timetable_id: timetableId
  });
};
