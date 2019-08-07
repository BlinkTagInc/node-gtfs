const CalendarDate = require('../../models/gtfs/calendar-date');

/*
 * Returns an array of calendarDates that match the query parameters.
 */
exports.getCalendarDates = (query = {}, projection = '-_id -created_at', options = {lean: true, timeout: true}) => {
  return CalendarDate.find(query, projection, options);
};
