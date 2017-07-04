const _ = require('lodash');

const Calendar = require('../../models/calendar');

/*
 * Returns an array of calendars, optionally bounded by startDate and
 * endDate
 */
exports.getCalendars = (agencyKey, startDate, endDate, monday, tuesday, wednesday, thursday, friday, saturday, sunday) => {
  const daysOfWeek = [];
  let daysOfWeekQuery;

  if (monday) {
    daysOfWeek.push({monday: 1});
  }
  if (tuesday) {
    daysOfWeek.push({tuesday: 1});
  }
  if (wednesday) {
    daysOfWeek.push({wednesday: 1});
  }
  if (thursday) {
    daysOfWeek.push({thursday: 1});
  }
  if (friday) {
    daysOfWeek.push({friday: 1});
  }
  if (saturday) {
    daysOfWeek.push({saturday: 1});
  }
  if (sunday) {
    daysOfWeek.push({sunday: 1});
  }

  if (daysOfWeek.length > 0) {
    daysOfWeekQuery = {$or: daysOfWeek};
  } else {
    daysOfWeekQuery = {$and: [
      {monday: 0},
      {tuesday: 0},
      {wednesday: 0},
      {thursday: 0},
      {friday: 0},
      {saturday: 0},
      {sunday: 0}
    ]};
  }

  return Calendar.find({
    $and: [
      {agency_key: agencyKey},
      {$and: [
        {start_date: {$lt: endDate}},
        {end_date: {$gte: startDate}}
      ]},
      daysOfWeekQuery
    ]
  });
};

/*
 * Returns an array of calendars for the `serviceIds` specified
 */
exports.getCalendarsByService = serviceIds => {
  if (!_.isArray(serviceIds)) {
    serviceIds = [serviceIds];
  }

  return Calendar.find({
    service_id: {
      $in: serviceIds
    }
  });
};
