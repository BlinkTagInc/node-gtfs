const utils = require('../utils');

const CalendarDate = require('../../models/gtfs/calendar-date');

/*
 * Returns an array of calendarDates that match the query parameters.
 */
exports.getCalendarDates = (query = {}, projection = utils.defaultProjection, options = { lean: true, timeout: true }) => {
  return CalendarDate.find(query, projection, options);
};
