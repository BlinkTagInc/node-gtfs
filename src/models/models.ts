import { IModel } from '../types/global_interfaces.ts';

import agency from './gtfs/agency.ts';
import areas from './gtfs/areas.ts';
import attributions from './gtfs/attributions.ts';
import bookingRules from './gtfs/booking-rules.ts';
import calendarDates from './gtfs/calendar-dates.ts';
import calendar from './gtfs/calendar.ts';
import fareAttributes from './gtfs/fare-attributes.ts';
import fareLegRules from './gtfs/fare-leg-rules.ts';
import fareMedia from './gtfs/fare-media.ts';
import fareProducts from './gtfs/fare-products.ts';
import fareRules from './gtfs/fare-rules.ts';
import fareTransferRules from './gtfs/fare-transfer-rules.ts';
import feedInfo from './gtfs/feed-info.ts';
import frequencies from './gtfs/frequencies.ts';
import levels from './gtfs/levels.ts';
import locationGroups from './gtfs/location-groups.ts';
import locationGroupStops from './gtfs/location-group-stops.ts';
import locations from './gtfs/locations.ts';
import networks from './gtfs/networks.ts';
import pathways from './gtfs/pathways.ts';
import routeNetworks from './gtfs/route-networks.ts';
import routes from './gtfs/routes.ts';
import shapes from './gtfs/shapes.ts';
import stopAreas from './gtfs/stop-areas.ts';
import stopTimes from './gtfs/stop-times.ts';
import stops from './gtfs/stops.ts';
import timeframes from './gtfs/timeframes.ts';
import transfers from './gtfs/transfers.ts';
import translations from './gtfs/translations.ts';
import trips from './gtfs/trips.ts';

import timetables from './non-standard/timetables.ts';
import timetablePages from './non-standard/timetable-pages.ts';
import timetableStopOrder from './non-standard/timetable-stop-order.ts';
import timetableNotes from './non-standard/timetable-notes.ts';
import timetableNotesReferences from './non-standard/timetable-notes-references.ts';
import tripsDatedVehicleJourney from './non-standard/trips-dated-vehicle-journey.ts';

import calendarAttributes from './gtfs-plus/calendar-attributes.ts';
import directions from './gtfs-plus/directions.ts';
import routeAttributes from './gtfs-plus/route-attributes.ts';
import stopAttributes from './gtfs-plus/stop-attributes.ts';

import boardAlight from './gtfs-ride/board-alight.ts';
import riderTrip from './gtfs-ride/rider-trip.ts';
import ridership from './gtfs-ride/ridership.ts';
import tripCapacity from './gtfs-ride/trip-capacity.ts';
import rideFeedInfo from './gtfs-ride/ride-feed-info.ts';

import tripUpdates from './gtfs-realtime/trip-updates.ts';
import stopTimeUpdates from './gtfs-realtime/stop-time-updates.ts';
import vehiclePositions from './gtfs-realtime/vehicle-positions.ts';
import serviceAlerts from './gtfs-realtime/service-alerts.ts';
import serviceAlertTargets from './gtfs-realtime/service-alert-targets.ts';

import deadheadTimes from './ods/deadhead-times.ts';
import deadheads from './ods/deadheads.ts';
import opsLocations from './ods/ops-locations.ts';
import runEvents from './ods/run-events.ts';
import runsPieces from './ods/runs-pieces.ts';

const models: IModel[] = [
  agency,
  areas,
  attributions,
  bookingRules,
  calendarDates,
  calendar,
  fareAttributes,
  fareLegRules,
  fareMedia,
  fareProducts,
  fareRules,
  fareTransferRules,
  feedInfo,
  frequencies,
  levels,
  locationGroups,
  locationGroupStops,
  locations,
  networks,
  pathways,
  routeNetworks,
  routes,
  shapes,
  stopAreas,
  stopTimes,
  stops,
  timeframes,
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
  stopTimeUpdates,
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
