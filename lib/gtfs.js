// GTFS import script
import { importGtfs, updateGtfsRealtime } from './import.js';

// GTFS export script
import exportGtfs from './export.js';

// Standard GTFS Filenames
import { getAgencies } from './gtfs/agencies.js';
import { getAreas } from './gtfs/areas.js';
import { getAttributions } from './gtfs/attributions.js';
import { getBookingRules } from './gtfs/booking-rules.js';
import { getCalendarDates } from './gtfs/calendar-dates.js';
import { getCalendars } from './gtfs/calendars.js';
import { getFareAttributes } from './gtfs/fare-attributes.js';
import { getFareLegRules } from './gtfs/fare-leg-rules.js';
import { getFareMedia } from './gtfs/fare-media.js';
import { getFareProducts } from './gtfs/fare-products.js';
import { getFareRules } from './gtfs/fare-rules.js';
import { getFareTransferRules } from './gtfs/fare-transfer-rules.js';
import { getFeedInfo } from './gtfs/feed-info.js';
import { getFrequencies } from './gtfs/frequencies.js';
import { getLevels } from './gtfs/levels.js';
import { getLocationGroups } from './gtfs/location-groups.js';
import { getLocationGroupStops } from './gtfs/location-group-stops.js';
import { getLocations } from './gtfs/locations.js';
import { getNetworks } from './gtfs/networks.js';
import { getPathways } from './gtfs/pathways.js';
import { getRouteNetworks } from './gtfs/route-networks.js';
import { getRoutes } from './gtfs/routes.js';
import { getShapes, getShapesAsGeoJSON } from './gtfs/shapes.js';
import { getStopAreas } from './gtfs/stop-areas.js';
import { getStops, getStopsAsGeoJSON } from './gtfs/stops.js';
import { getStoptimes } from './gtfs/stop-times.js';
import { getTimeframes } from './gtfs/timeframes.js';
import { getTransfers } from './gtfs/transfers.js';
import { getTranslations } from './gtfs/translations.js';
import { getTrips } from './gtfs/trips.js';

// GTFS Plus Filenames
import { getCalendarAttributes } from './gtfs-plus/calendar-attributes.js';
import { getDirections } from './gtfs-plus/directions.js';
import { getRouteAttributes } from './gtfs-plus/route-attributes.js';
import { getStopAttributes } from './gtfs-plus/stop-attributes.js';

// Non-standard GTFS Filenames
import { getTimetables } from './non-standard/timetables.js';
import { getTimetableStopOrders } from './non-standard/timetable-stop-order.js';
import { getTimetablePages } from './non-standard/timetable-pages.js';
import { getTimetableNotes } from './non-standard/timetable-notes.js';
import { getTimetableNotesReferences } from './non-standard/timetable-notes-references.js';
import { getTripsDatedVehicleJourneys } from './non-standard/trips-dated-vehicle-journey.js';

// GTFS-ride Filenames
import { getBoardAlights } from './gtfs-ride/board-alights.js';
import { getRideFeedInfos } from './gtfs-ride/ride-feed-infos.js';
import { getRiderTrips } from './gtfs-ride/rider-trips.js';
import { getRiderships } from './gtfs-ride/riderships.js';
import { getTripCapacities } from './gtfs-ride/trip-capacities.js';

// GTFS-Realtime Filenames
import { getStopTimeUpdates } from './gtfs-realtime/stop-time-updates.js';
import { getTripUpdates } from './gtfs-realtime/trip-updates.js';
import { getVehiclePositions } from './gtfs-realtime/vehicle-positions.js';
import { getServiceAlerts } from './gtfs-realtime/service-alerts.js';

// ODS Filenames
import { getDeadheads } from './ods/deadheads.js';
import { getDeadheadTimes } from './ods/deadhead-times.js';
import { getOpsLocations } from './ods/ops-locations.js';
import { getRunEvents } from './ods/run-events.js';
import { getRunsPieces } from './ods/runs-pieces.js';

// Expose database connection
import { deleteDb, openDb, closeDb } from './db.js';

// Advanced Query
import { advancedQuery } from './advancedQuery.js';

const _importGtfs = importGtfs;
export { _importGtfs as importGtfs };
const _exportGtfs = exportGtfs;
export { _exportGtfs as exportGtfs };

const _getAgencies = getAgencies;
export { _getAgencies as getAgencies };

const _getAreas = getAreas;
export { _getAreas as getAreas };

const _getAttributions = getAttributions;
export { _getAttributions as getAttributions };

const _getBookingRules = getBookingRules;
export { _getBookingRules as getBookingRules };

const _getCalendarDates = getCalendarDates;
export { _getCalendarDates as getCalendarDates };

const _getCalendars = getCalendars;
export { _getCalendars as getCalendars };

const _getFareAttributes = getFareAttributes;
export { _getFareAttributes as getFareAttributes };

const _getFareLegRules = getFareLegRules;
export { _getFareLegRules as getFareLegRules };

const _getFareMedia = getFareMedia;
export { _getFareMedia as getFareMedia };

const _getFareProducts = getFareProducts;
export { _getFareProducts as getFareProducts };

const _getFareRules = getFareRules;
export { _getFareRules as getFareRules };

const _getFareTransferRules = getFareTransferRules;
export { _getFareTransferRules as getFareTransferRules };

const _getFeedInfo = getFeedInfo;
export { _getFeedInfo as getFeedInfo };

const _getFrequencies = getFrequencies;
export { _getFrequencies as getFrequencies };

const _getLevels = getLevels;
export { _getLevels as getLevels };

const _getLocationGroups = getLocationGroups;
export { _getLocationGroups as getLocationGroups };

const _getLocationGroupStops = getLocationGroupStops;
export { _getLocationGroupStops as getLocationGroupStops };

const _getLocations = getLocations;
export { _getLocations as getLocations };

const _getNetworks = getNetworks;
export { _getNetworks as getNetworks };

const _getPathways = getPathways;
export { _getPathways as getPathways };

const _getRouteNetworks = getRouteNetworks;
export { _getRouteNetworks as getRouteNetworks };

const _getRoutes = getRoutes;
export { _getRoutes as getRoutes };

const _getShapes = getShapes;
export { _getShapes as getShapes };
const _getShapesAsGeoJSON = getShapesAsGeoJSON;
export { _getShapesAsGeoJSON as getShapesAsGeoJSON };

const _getStopAreas = getStopAreas;
export { _getStopAreas as getStopAreas };

const _getStops = getStops;
export { _getStops as getStops };
const _getStopsAsGeoJSON = getStopsAsGeoJSON;
export { _getStopsAsGeoJSON as getStopsAsGeoJSON };

const _getStoptimes = getStoptimes;
export { _getStoptimes as getStoptimes };

const _getTimeframes = getTimeframes;
export { _getTimeframes as getTimeframes };

const _getTransfers = getTransfers;
export { _getTransfers as getTransfers };

const _getTrips = getTrips;
export { _getTrips as getTrips };

const _getTranslations = getTranslations;
export { _getTranslations as getTranslations };

const _getCalendarAttributes = getCalendarAttributes;
export { _getCalendarAttributes as getCalendarAttributes };

const _getDirections = getDirections;
export { _getDirections as getDirections };

const _getRouteAttributes = getRouteAttributes;
export { _getRouteAttributes as getRouteAttributes };

const _getStopAttributes = getStopAttributes;
export { _getStopAttributes as getStopAttributes };

const _getTimetables = getTimetables;
export { _getTimetables as getTimetables };

const _getTimetableStopOrders = getTimetableStopOrders;
export { _getTimetableStopOrders as getTimetableStopOrders };

const _getTimetablePages = getTimetablePages;
export { _getTimetablePages as getTimetablePages };

const _getTimetableNotes = getTimetableNotes;
export { _getTimetableNotes as getTimetableNotes };

const _getTimetableNotesReferences = getTimetableNotesReferences;
export { _getTimetableNotesReferences as getTimetableNotesReferences };

const _getTripsDatedVehicleJourneys = getTripsDatedVehicleJourneys;
export { _getTripsDatedVehicleJourneys as getTripsDatedVehicleJourneys };

const _getBoardAlights = getBoardAlights;
export { _getBoardAlights as getBoardAlights };

const _getRideFeedInfos = getRideFeedInfos;
export { _getRideFeedInfos as getRideFeedInfos };

const _getRiderTrips = getRiderTrips;
export { _getRiderTrips as getRiderTrips };

const _getRiderships = getRiderships;
export { _getRiderships as getRiderships };

const _getTripCapacities = getTripCapacities;
export { _getTripCapacities as getTripCapacities };

const _updateGtfsRealtime = updateGtfsRealtime;
export { _updateGtfsRealtime as updateGtfsRealtime };

const _getStopTimeUpdates = getStopTimeUpdates;
export { _getStopTimeUpdates as getStopTimeUpdates };

const _getTripUpdates = getTripUpdates;
export { _getTripUpdates as getTripUpdates };

const _getVehiclePositions = getVehiclePositions;
export { _getVehiclePositions as getVehiclePositions };

const _getServiceAlerts = getServiceAlerts;
export { _getServiceAlerts as getServiceAlerts };

const _getDeadheads = getDeadheads;
export { _getDeadheads as getDeadheads };

const _getDeadheadTimes = getDeadheadTimes;
export { _getDeadheadTimes as getDeadheadTimes };

const _getOpsLocations = getOpsLocations;
export { _getOpsLocations as getOpsLocations };

const _getRunEvents = getRunEvents;
export { _getRunEvents as getRunEvents };

const _getRunsPieces = getRunsPieces;
export { _getRunsPieces as getRunsPieces };

const _openDb = openDb;
export { _openDb as openDb };
const _closeDb = closeDb;
export { _closeDb as closeDb };
const _deleteDb = deleteDb;
export { _deleteDb as deleteDb };

const _advancedQuery = advancedQuery;
export { _advancedQuery as advancedQuery };
