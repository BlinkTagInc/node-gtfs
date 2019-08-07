const TimetablePage = require('../../models/non-standard/timetable-page');

/*
 * Returns an array of timetable_pages that match the query parameters.
 */
exports.getTimetablePages = (query = {}, projection = '-_id -created_at', options = {lean: true, timeout: true}) => {
  return TimetablePage.find(query, projection, options);
};
