const _ = require('lodash');

const Calendar = require('../../models/Calendar');

/*
 * Returns an array of calendars, optionally bounded by start_date and
 * end_date
 */
exports.getCalendars = (agency_key, start_date, end_date, monday, tuesday, wednesday, thursday, friday, saturday, sunday, cb) => {
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

  if (daysOfWeek.length) {
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
      {agency_key},
      {$and: [
        {start_date: {$lt: end_date}},
        {end_date: {$gte: start_date}}
      ]},
      daysOfWeekQuery
    ]
  }).exec(cb);
};


/*
 * Returns an array of calendars for the `service_ids` specified
 */
exports.getCalendarsByService = (service_ids, cb) => {
  if (!_.isArray(service_ids)) {
    service_ids = [service_ids];
  }

  return Calendar.find({
    service_id: {
      $in: service_ids
    }
  }).exec(cb);
};
