// GTFS import script
const importGTFS = require('./import');

// GTFS export script
const exportGTFS = require('./export');

// Standard GTFS Filenames
const { getAgencies } = require('./gtfs/agencies');
const { getAttributions } = require('./gtfs/attributions');
const { getCalendarDates } = require('./gtfs/calendar-dates');
const { getCalendars } = require('./gtfs/calendars');
const { getFareAttributes } = require('./gtfs/fare-attributes');
const { getFareRules } = require('./gtfs/fare-rules');
const { getFeedInfo } = require('./gtfs/feed-info');
const { getFrequencies } = require('./gtfs/frequencies');
const { getLevels } = require('./gtfs/levels');
const { getPathways } = require('./gtfs/pathways');
const { getRoutes } = require('./gtfs/routes');
const { getShapes, getShapesAsGeoJSON } = require('./gtfs/shapes');
const { getStops, getStopsAsGeoJSON } = require('./gtfs/stops');
const { getStoptimes } = require('./gtfs/stop-times');
const { getTransfers } = require('./gtfs/transfers');
const { getTranslations } = require('./gtfs/translations');
const { getTrips } = require('./gtfs/trips');

// Non-standard GTFS Filenames
const { getDirections } = require('./non-standard/directions');
const { getStopAttributes } = require('./non-standard/stop-attributes');
const { getTimetables } = require('./non-standard/timetables');
const { getTimetableStopOrders } = require('./non-standard/timetable-stop-order');
const { getTimetablePages } = require('./non-standard/timetable-pages');

// Expose database connection
const { openDb, closeDb, getDb } = require('./db');

exports.import = importGTFS;
exports.export = exportGTFS;

exports.getAgencies = getAgencies;

exports.getAttributions = getAttributions;

exports.getCalendarDates = getCalendarDates;

exports.getCalendars = getCalendars;

exports.getFareAttributes = getFareAttributes;

exports.getFareRules = getFareRules;

exports.getFeedInfo = getFeedInfo;

exports.getFrequencies = getFrequencies;

exports.getLevels = getLevels;

exports.getPathways = getPathways;

exports.getRoutes = getRoutes;

exports.getShapes = getShapes;
exports.getShapesAsGeoJSON = getShapesAsGeoJSON;

exports.getStops = getStops;
exports.getStopsAsGeoJSON = getStopsAsGeoJSON;

exports.getStoptimes = getStoptimes;

exports.getTransfers = getTransfers;

exports.getTrips = getTrips;

exports.getTranslations = getTranslations;

exports.getDirections = getDirections;

exports.getStopAttributes = getStopAttributes;

exports.getTimetables = getTimetables;

exports.getTimetableStopOrders = getTimetableStopOrders;

exports.getTimetablePages = getTimetablePages;

exports.openDb = openDb;
exports.closeDb = closeDb;
exports.getDb = getDb;
