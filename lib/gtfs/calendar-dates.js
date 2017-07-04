const _ = require('lodash');

const CalendarDate = require('../../models/calendar-date');

/*
 * Returns an array of calendarDates for the `serviceIds` specified
 */
exports.getCalendarDatesByService = serviceIds => {
  if (!_.isArray(serviceIds)) {
    serviceIds = [serviceIds];
  }

  return CalendarDate.find({
    service_id: {
      $in: serviceIds
    }
  });
};
