const Timetable = require('../../models/timetable');

/*
 * Returns an array of timetables that match the query parameters.
 */
exports.getTimetables = query => Timetable.find(query);
