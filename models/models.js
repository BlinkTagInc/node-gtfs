import agency from '../models/gtfs/agency.js';
import attributions from '../models/gtfs/attributions.js';
import calendarDates from '../models/gtfs/calendar-dates.js';
import calendar from '../models/gtfs/calendar.js';
import fareAttributes from '../models/gtfs/fare-attributes.js';
import fareRules from '../models/gtfs/fare-rules.js';
import feedInfo from '../models/gtfs/feed-info.js';
import frequencies from '../models/gtfs/frequencies.js';
import levels from '../models/gtfs/levels.js';
import pathways from '../models/gtfs/pathways.js';
import routes from '../models/gtfs/routes.js';
import shapes from '../models/gtfs/shapes.js';
import stopTimes from '../models/gtfs/stop-times.js';
import stops from '../models/gtfs/stops.js';
import transfers from '../models/gtfs/transfers.js';
import translations from '../models/gtfs/translations.js';
import trips from '../models/gtfs/trips.js';

import directions from '../models/non-standard/directions.js';
import stopAttributes from '../models/non-standard/stop-attributes.js';
import timetables from '../models/non-standard/timetables.js';
import timetablePages from '../models/non-standard/timetable-pages.js';
import timetableStopOrder from '../models/non-standard/timetable-stop-order.js';
import timetableNotes from '../models/non-standard/timetable-notes.js';
import timetableNotesReferences from '../models/non-standard/timetable-notes-references.js';
import tripsDatedVehicleJourney from '../models/non-standard/trips-dated-vehicle-journey.js'

import boardAlight from '../models/gtfs-ride/board-alight.js';
import riderTrip from '../models/gtfs-ride/rider-trip.js';
import ridership from '../models/gtfs-ride/ridership.js';
import tripCapacity from '../models/gtfs-ride/trip-capacity.js';
import rideFeedInfo from './gtfs-ride/ride-feed-info.js';

const models = [
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
  tripsDatedVehicleJourney,
  boardAlight,
  rideFeedInfo,
  riderTrip,
  ridership,
  tripCapacity,
];

export default models;
