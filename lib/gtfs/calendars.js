const Calendar = require('../../models/calendar');

/*
 * Returns an array of calendars that match the query parameters.
 */
exports.getCalendars = query => Calendar.find(query);
