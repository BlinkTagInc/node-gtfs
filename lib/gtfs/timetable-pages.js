const TimetablePage = require('../../models/timetable-page');

/*
 * Returns an array of timetable_pages that match the query parameters.
 */
exports.getTimetablePages = query => TimetablePage.find(query, '-_id').lean();
