const TimetablePage = require('../../models/timetable-page');

/*
 * Returns an array of timetable_pages for the `agencyKey` specified
 */
exports.getTimetablePagesByAgency = (agencyKey, cb) => {
  return TimetablePage.find({
    agency_key: agencyKey
  }).exec(cb);
};

/*
 * Returns an array timetable_pages matching the `timetablePageId` specified
 */
exports.getTimetablePage = (agencyKey, timetablePageId, cb) => {
  return TimetablePage.findOne({
    agency_key: agencyKey,
    timetable_page_id: timetablePageId
  }).exec(cb);
};
