import agency from '../models/gtfs/agency.js';
import areas from '../models/gtfs/areas.js';
import attributions from '../models/gtfs/attributions.js';
import calendarDates from '../models/gtfs/calendar-dates.js';
import calendar from '../models/gtfs/calendar.js';
import fareAttributes from '../models/gtfs/fare-attributes.js';
import fareLegRules from '../models/gtfs/fare-leg-rules.js';
import fareProducts from '../models/gtfs/fare-products.js';
import fareRules from '../models/gtfs/fare-rules.js';
import fareTransferRules from '../models/gtfs/fare-transfer-rules.js';
import feedInfo from '../models/gtfs/feed-info.js';
import frequencies from '../models/gtfs/frequencies.js';
import levels from '../models/gtfs/levels.js';
import pathways from '../models/gtfs/pathways.js';
import routes from '../models/gtfs/routes.js';
import shapes from '../models/gtfs/shapes.js';
import stopAreas from '../models/gtfs/stop-areas.js';
import stopTimes from '../models/gtfs/stop-times.js';
import stops from '../models/gtfs/stops.js';
import transfers from '../models/gtfs/transfers.js';
import translations from '../models/gtfs/translations.js';
import trips from '../models/gtfs/trips.js';

import timetables from '../models/non-standard/timetables.js';
import timetablePages from '../models/non-standard/timetable-pages.js';
import timetableStopOrder from '../models/non-standard/timetable-stop-order.js';
import timetableNotes from '../models/non-standard/timetable-notes.js';
import timetableNotesReferences from '../models/non-standard/timetable-notes-references.js';
import tripsDatedVehicleJourney from '../models/non-standard/trips-dated-vehicle-journey.js';

import calendarAttributes from '../models/gtfs-plus/calendar-attributes.js';
import directions from '../models/gtfs-plus/directions.js';
import routeAttributes from '../models/gtfs-plus/route-attributes.js';
import stopAttributes from '../models/gtfs-plus/stop-attributes.js';

import boardAlight from '../models/gtfs-ride/board-alight.js';
import riderTrip from '../models/gtfs-ride/rider-trip.js';
import ridership from '../models/gtfs-ride/ridership.js';
import tripCapacity from '../models/gtfs-ride/trip-capacity.js';
import rideFeedInfo from './gtfs-ride/ride-feed-info.js';

import tripUpdates from './gtfs-realtime/trip-updates.js';
import stopTimesUpdates from './gtfs-realtime/stop-times-updates.js';
import vehiclePositions from './gtfs-realtime/vehicle-positions.js';
import serviceAlerts from './gtfs-realtime/service-alerts.js';
import serviceAlertTargets from './gtfs-realtime/service-alert-targets.js';

import deadheadTimes from './ods/deadhead-times.js';
import deadheads from './ods/deadheads.js';
import opsLocations from './ods/ops-locations.js';
import runEvents from './ods/run-events.js';
import runsPieces from './ods/runs-pieces.js';

const models = [
  agency,
  areas,
  attributions,
  calendarDates,
  calendar,
  fareAttributes,
  fareLegRules,
  fareProducts,
  fareRules,
  fareTransferRules,
  feedInfo,
  frequencies,
  levels,
  pathways,
  routes,
  shapes,
  stopAreas,
  stopTimes,
  stops,
  transfers,
  translations,
  trips,
  timetables,
  timetablePages,
  timetableStopOrder,
  timetableNotes,
  timetableNotesReferences,
  tripsDatedVehicleJourney,
  calendarAttributes,
  directions,
  routeAttributes,
  stopAttributes,
  boardAlight,
  rideFeedInfo,
  riderTrip,
  ridership,
  tripCapacity,
  tripUpdates,
  stopTimesUpdates,
  vehiclePositions,
  serviceAlerts,
  serviceAlertTargets,
  deadheadTimes,
  deadheads,
  opsLocations,
  runEvents,
  runsPieces,
];

export default models;
