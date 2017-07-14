const CalendarDate = require('../../models/calendar-date');

/*
 * Returns an array of calendarDates that match the query parameters.
 */
exports.getCalendarDates = query => CalendarDate.find(query);
