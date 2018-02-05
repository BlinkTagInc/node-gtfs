const Agency = require('../models/gtfs/agency');
const CalendarDate = require('../models/gtfs/calendar-date');
const Calendar = require('../models/gtfs/calendar');
const FareAttribute = require('../models/gtfs/fare-attribute');
const FareRule = require('../models/gtfs/fare-rule');
const FeedInfo = require('../models/gtfs/feed-info');
const Frequencies = require('../models/gtfs/frequencies');
const Route = require('../models/gtfs/route');
const Shape = require('../models/gtfs/shape');
const StopTime = require('../models/gtfs/stop-time');
const Stop = require('../models/gtfs/stop');
const Transfer = require('../models/gtfs/transfer');
const Trip = require('../models/gtfs/trip');

const StopAttributes = require('../models/non-standard/stop-attributes');
const Timetable = require('../models/non-standard/timetable');
const TimetablePage = require('../models/non-standard/timetable-page');
const TimetableStopOrder = require('../models/non-standard/timetable-stop-order');

module.exports = [
  {
    filenameBase: 'agency',
    model: Agency
  }, {
    filenameBase: 'calendar_dates',
    model: CalendarDate
  }, {
    filenameBase: 'calendar',
    model: Calendar
  }, {
    filenameBase: 'fare_attributes',
    model: FareAttribute
  }, {
    filenameBase: 'fare_rules',
    model: FareRule
  }, {
    filenameBase: 'feed_info',
    model: FeedInfo
  }, {
    filenameBase: 'frequencies',
    model: Frequencies
  }, {
    filenameBase: 'routes',
    model: Route
  }, {
    filenameBase: 'shapes',
    model: Shape
  }, {
    filenameBase: 'stop_times',
    model: StopTime
  }, {
    filenameBase: 'stops',
    model: Stop
  }, {
    filenameBase: 'transfers',
    model: Transfer
  }, {
    filenameBase: 'trips',
    model: Trip
  }, {
    filenameBase: 'stop_attributes',
    model: StopAttributes,
    nonstandard: true
  }, {
    filenameBase: 'timetables',
    model: Timetable,
    nonstandard: true
  }, {
    filenameBase: 'timetable_pages',
    model: TimetablePage,
    nonstandard: true
  }, {
    filenameBase: 'timetable_stop_order',
    model: TimetableStopOrder,
    nonstandard: true
  }
];
