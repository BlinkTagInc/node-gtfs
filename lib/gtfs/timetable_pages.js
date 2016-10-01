const TimetablePage = require('../../models/TimetablePage');

/*
 * Returns an array of timetable_pages for the `agency_key` specified
 */
exports.getTimetablePagesByAgency = (agency_key, cb) => {
  return TimetablePage.find({
    agency_key
  }).exec(cb);
};


/*
 * Returns an array timetable_pages matching the `timetable_page_id` specified
 */
exports.getTimetablePage = (agency_key, timetable_page_id, cb) => {
  return TimetablePage.findOne({
    agency_key,
    timetable_page_id
  }).exec(cb);
};
