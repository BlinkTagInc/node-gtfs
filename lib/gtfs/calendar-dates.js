const CalendarDate = require('../../models/gtfs/calendar-date');

/*
 * Returns an array of calendarDates that match the query parameters.
 */
exports.getCalendarDates = (query = {}, projection = '-_id', options = {lean: true}) => {
  return CalendarDate.find(query, projection, options);
};
