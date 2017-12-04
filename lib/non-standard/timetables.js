const Timetable = require('../../models/non-standard/timetable');

/*
 * Returns an array of timetables that match the query parameters.
 */
exports.getTimetables = (query = {}, projection = '-_id', options = {lean: true}) => {
  return Timetable.find(query, projection, options);
};
