const Timetable = require('../../models/timetable');

/*
 * Returns an array of timetables that match the query parameters.
 */
exports.getTimetables = (query = {}, projection = '-_id', options = {lean: true}) => {
  Timetable.find(query, projection, options);
};
