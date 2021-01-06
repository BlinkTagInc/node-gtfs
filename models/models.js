const agency = require('../models/gtfs/agency');
const attributions = require('../models/gtfs/attributions');
const calendarDates = require('../models/gtfs/calendar-dates');
const calendar = require('../models/gtfs/calendar');
const fareAttributes = require('../models/gtfs/fare-attributes');
const fareRules = require('../models/gtfs/fare-rules');
const feedInfo = require('../models/gtfs/feed-info');
const frequencies = require('../models/gtfs/frequencies');
const levels = require('../models/gtfs/levels');
const pathways = require('../models/gtfs/pathways');
const routes = require('../models/gtfs/routes');
const shapes = require('../models/gtfs/shapes');
const stopTimes = require('../models/gtfs/stop-times');
const stops = require('../models/gtfs/stops');
const transfers = require('../models/gtfs/transfers');
const translations = require('../models/gtfs/translations');
const trips = require('../models/gtfs/trips');

const directions = require('../models/non-standard/directions');
const stopAttributes = require('../models/non-standard/stop-attributes');
const timetables = require('../models/non-standard/timetables');
const timetablePages = require('../models/non-standard/timetable-pages');
const timetableStopOrder = require('../models/non-standard/timetable-stop-order');
const timetableNotes = require('../models/non-standard/timetable-notes');
const timetableNotesReferences = require('../models/non-standard/timetable-notes-references');

const boardAlight = require('../models/gtfs-ride/board-alight');
const rideFeedInfo = require('../models/gtfs-ride/ride-feed-info');
const riderTrip = require('../models/gtfs-ride/rider-trip');
const ridership = require('../models/gtfs-ride/ridership');
const tripCapacity = require('../models/gtfs-ride/trip-capacity');

module.exports = [
  agency,
  attributions,
  calendarDates,
  calendar,
  fareAttributes,
  fareRules,
  feedInfo,
  frequencies,
  levels,
  pathways,
  routes,
  shapes,
  stopTimes,
  stops,
  transfers,
  translations,
  trips,
  directions,
  stopAttributes,
  timetables,
  timetablePages,
  timetableStopOrder,
  timetableNotes,
  timetableNotesReferences,
  boardAlight,
  rideFeedInfo,
  riderTrip,
  ridership,
  tripCapacity
];
