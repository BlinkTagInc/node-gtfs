// GTFS import script
export { importGtfs, importGtfsToKysely } from './lib/import-gtfs.ts';
export type {
  KyselyImportDialect,
  KyselyImportOptions,
} from './lib/kysely-gtfs-writer.ts';
export * from './schema/index.ts';
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
export {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
  GtfsWarningCode,
  isGtfsError,
  isGtfsValidationError,
  formatGtfsError,
} from './lib/errors.ts';
export type { GtfsWarning, ImportReport } from './lib/errors.ts';

// gtfs-schedule
export { getAgencies } from './lib/gtfs/agencies.ts';
export { getAreas } from './lib/gtfs/areas.ts';
export { getAttributions } from './lib/gtfs/attributions.ts';
export { getBookingRules } from './lib/gtfs/booking-rules.ts';
export { getCalendars, getServiceIdsByDate } from './lib/gtfs/calendars.ts';
export { getCalendarDates } from './lib/gtfs/calendar-dates.ts';
export { getFareAttributes } from './lib/gtfs/fare-attributes.ts';
export { getFareLegJoinRules } from './lib/gtfs/fare-leg-join-rules.ts';
export { getFareLegRules } from './lib/gtfs/fare-leg-rules.ts';
export { getFareMedia } from './lib/gtfs/fare-media.ts';
export { getFareProducts } from './lib/gtfs/fare-products.ts';
export { getFareRules } from './lib/gtfs/fare-rules.ts';
export { getFareTransferRules } from './lib/gtfs/fare-transfer-rules.ts';
export { getFeedInfo } from './lib/gtfs/feed-info.ts';
export { getFrequencies } from './lib/gtfs/frequencies.ts';
export { getLevels } from './lib/gtfs/levels.ts';
export { getLocationGroupStops } from './lib/gtfs/location-group-stops.ts';
export { getLocationGroups } from './lib/gtfs/location-groups.ts';
export { getLocations } from './lib/gtfs/locations.ts';
export { getNetworks } from './lib/gtfs/networks.ts';
export { getPathways } from './lib/gtfs/pathways.ts';
export { getRiderCategories } from './lib/gtfs/rider-categories.ts';
export { getRouteNetworks } from './lib/gtfs/route-networks.ts';
export { getRoutes } from './lib/gtfs/routes.ts';
export { getShapes, getShapesAsGeoJSON } from './lib/gtfs/shapes.ts';
export { getStopAreas } from './lib/gtfs/stop-areas.ts';
export { getStoptimes } from './lib/gtfs/stop-times.ts';
export { getStops, getStopsAsGeoJSON } from './lib/gtfs/stops.ts';
export { getTimeframes } from './lib/gtfs/timeframes.ts';
export { getTransfers } from './lib/gtfs/transfers.ts';
export { getTranslations } from './lib/gtfs/translations.ts';
export { getTrips } from './lib/gtfs/trips.ts';

// gtfs-realtime
export { getServiceAlertInformedEntities } from './lib/gtfs-realtime/service-alert-informed-entities.ts';
export { getServiceAlerts } from './lib/gtfs-realtime/service-alerts.ts';
export { getStopTimeUpdates } from './lib/gtfs-realtime/stop-time-updates.ts';
export { getTripUpdates } from './lib/gtfs-realtime/trip-updates.ts';
export { getVehiclePositions } from './lib/gtfs-realtime/vehicle-positions.ts';

// gtfs-plus
export { getCalendarAttributes } from './lib/gtfs-plus/calendar-attributes.ts';
export { getDirections } from './lib/gtfs-plus/directions.ts';
export { getRouteAttributes } from './lib/gtfs-plus/route-attributes.ts';
export { getStopAttributes } from './lib/gtfs-plus/stop-attributes.ts';

// gtfs-ride
export { getBoardAlights } from './lib/gtfs-ride/board-alights.ts';
export { getRideFeedInfo } from './lib/gtfs-ride/ride-feed-info.ts';
export { getRiderTrips } from './lib/gtfs-ride/rider-trips.ts';
export { getRidership } from './lib/gtfs-ride/ridership.ts';
export { getTripCapacities } from './lib/gtfs-ride/trip-capacities.ts';

// gtfs-to-html
export { getTimetableNotes } from './lib/gtfs-to-html/timetable-notes.ts';
export { getTimetableNotesReferences } from './lib/gtfs-to-html/timetable-notes-references.ts';
export { getTimetablePages } from './lib/gtfs-to-html/timetable-pages.ts';
export { getTimetableStopOrders } from './lib/gtfs-to-html/timetable-stop-order.ts';
export { getTimetables } from './lib/gtfs-to-html/timetables.ts';

// noptis
export { getTripsDatedVehicleJourneys } from './lib/noptis/trips-dated-vehicle-journey.ts';

// tods
export { getDeadheadTimes } from './lib/tods/deadhead-times.ts';
export { getDeadheads } from './lib/tods/deadheads.ts';
export { getOpsLocations } from './lib/tods/ops-locations.ts';
export { getRunEvents } from './lib/tods/run-events.ts';
export { getRunsPieces } from './lib/tods/runs-pieces.ts';

// tides
export { getDevices } from './lib/tides/devices.ts';
export { getFareTransactions } from './lib/tides/fare-transactions.ts';
export { getOperators } from './lib/tides/operators.ts';
export { getPassengerEvents } from './lib/tides/passenger-events.ts';
export { getStationActivities } from './lib/tides/station-activities.ts';
export { getStopVisits } from './lib/tides/stop-visits.ts';
export { getTrainCars } from './lib/tides/train-cars.ts';
export { getTripsPerformed } from './lib/tides/trips-performed.ts';
export { getVehicleLocations } from './lib/tides/vehicle-locations.ts';
export { getVehicleTrainCars } from './lib/tides/vehicle-train-cars.ts';
export { getVehicles } from './lib/tides/vehicles.ts';

export type * from './types/index.ts';
