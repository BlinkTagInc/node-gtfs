// GTFS import script
export { importGtfs } from './lib/import-gtfs.ts';
export { updateGtfsRealtime } from './lib/import-gtfs-realtime.ts';

// GTFS export script
export { exportGtfs } from './lib/export.ts';

// Database connection functions
export { deleteDb, openDb, closeDb } from './lib/db.ts';

// Advanced Query
export { advancedQuery } from './lib/advancedQuery.ts';

// Utility functions
export {
  prepDirectory,
  unzip,
  generateFolderName,
  untildify,
} from './lib/file-utils.ts';

// Standard GTFS
export { getAgencies } from './lib/gtfs/agencies.ts';
export { getAreas } from './lib/gtfs/areas.ts';
export { getAttributions } from './lib/gtfs/attributions.ts';
export { getBookingRules } from './lib/gtfs/booking-rules.ts';
export { getCalendarDates } from './lib/gtfs/calendar-dates.ts';
export { getCalendars } from './lib/gtfs/calendars.ts';
export { getServiceIdsByDate } from './lib/gtfs/calendars.ts';
export { getFareAttributes } from './lib/gtfs/fare-attributes.ts';
export { getFareLegRules } from './lib/gtfs/fare-leg-rules.ts';
export { getFareMedia } from './lib/gtfs/fare-media.ts';
export { getFareProducts } from './lib/gtfs/fare-products.ts';
export { getFareRules } from './lib/gtfs/fare-rules.ts';
export { getFareTransferRules } from './lib/gtfs/fare-transfer-rules.ts';
export { getFeedInfo } from './lib/gtfs/feed-info.ts';
export { getFrequencies } from './lib/gtfs/frequencies.ts';
export { getLevels } from './lib/gtfs/levels.ts';
export { getLocationGroups } from './lib/gtfs/location-groups.ts';
export { getLocationGroupStops } from './lib/gtfs/location-group-stops.ts';
export { getLocations } from './lib/gtfs/locations.ts';
export { getNetworks } from './lib/gtfs/networks.ts';
export { getPathways } from './lib/gtfs/pathways.ts';
export { getRiderCategories } from './lib/gtfs/rider-categories.ts';
export { getRouteNetworks } from './lib/gtfs/route-networks.ts';
export { getRoutes } from './lib/gtfs/routes.ts';
export { getShapes, getShapesAsGeoJSON } from './lib/gtfs/shapes.ts';
export { getStopAreas } from './lib/gtfs/stop-areas.ts';
export { getStops, getStopsAsGeoJSON } from './lib/gtfs/stops.ts';
export { getStoptimes } from './lib/gtfs/stop-times.ts';
export { getTimeframes } from './lib/gtfs/timeframes.ts';
export { getTransfers } from './lib/gtfs/transfers.ts';
export { getTranslations } from './lib/gtfs/translations.ts';
export { getTrips } from './lib/gtfs/trips.ts';

// GTFS Plus
export { getCalendarAttributes } from './lib/gtfs-plus/calendar-attributes.ts';
export { getDirections } from './lib/gtfs-plus/directions.ts';
export { getRouteAttributes } from './lib/gtfs-plus/route-attributes.ts';
export { getStopAttributes } from './lib/gtfs-plus/stop-attributes.ts';

// Non-standard GTFS
export { getTimetables } from './lib/non-standard/timetables.ts';
export { getTimetableStopOrders } from './lib/non-standard/timetable-stop-order.ts';
export { getTimetablePages } from './lib/non-standard/timetable-pages.ts';
export { getTimetableNotes } from './lib/non-standard/timetable-notes.ts';
export { getTimetableNotesReferences } from './lib/non-standard/timetable-notes-references.ts';
export { getTripsDatedVehicleJourneys } from './lib/non-standard/trips-dated-vehicle-journey.ts';

// GTFS-ride
export { getBoardAlights } from './lib/gtfs-ride/board-alights.ts';
export { getRideFeedInfo } from './lib/gtfs-ride/ride-feed-info.ts';
export { getRiderTrips } from './lib/gtfs-ride/rider-trips.ts';
export { getRidership } from './lib/gtfs-ride/ridership.ts';
export { getTripCapacities } from './lib/gtfs-ride/trip-capacities.ts';

// GTFS-Realtime
export { getStopTimeUpdates } from './lib/gtfs-realtime/stop-time-updates.ts';
export { getTripUpdates } from './lib/gtfs-realtime/trip-updates.ts';
export { getVehiclePositions } from './lib/gtfs-realtime/vehicle-positions.ts';
export { getServiceAlerts } from './lib/gtfs-realtime/service-alerts.ts';

// ODS
export { getDeadheads } from './lib/ods/deadheads.ts';
export { getDeadheadTimes } from './lib/ods/deadhead-times.ts';
export { getOpsLocations } from './lib/ods/ops-locations.ts';
export { getRunEvents } from './lib/ods/run-events.ts';
export { getRunsPieces } from './lib/ods/runs-pieces.ts';

export * from './types/global_interfaces.ts';
export type { Model } from './types/global_interfaces.ts';
