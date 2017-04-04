// GTFS import script
const importGTFS = require('./import');

// Standard GTFS Filenames
const agencies = require('./gtfs/agencies');
const calendars = require('./gtfs/calendars');
const calendarDates = require('./gtfs/calendar-dates');
const fareAttributes = require('./gtfs/fare-attributes');
const fareRules = require('./gtfs/fare-rules');
const feedInfo = require('./gtfs/feed-info');
const routes = require('./gtfs/routes');
const shapes = require('./gtfs/shapes');
const stops = require('./gtfs/stops');
const stopTimes = require('./gtfs/stop-times');
const trips = require('./gtfs/trips');

// Non-standard GTFS Filenames
const stopAttributes = require('./gtfs/stop-attributes');
const timetables = require('./gtfs/timetables');
const timetableStopOrder = require('./gtfs/timetable-stop-order');
const timetablePages = require('./gtfs/timetable-pages');

exports.import = importGTFS;

exports.agencies = agencies.agencies;
exports.getAgency = agencies.getAgency;
exports.getAgenciesByDistance = agencies.getAgenciesByDistance;

exports.getRoutesByAgency = routes.getRoutesByAgency;
exports.getRoutesById = routes.getRoutesById;
exports.getRoutesByDistance = routes.getRoutesByDistance;
exports.getRoutesByStop = routes.getRoutesByStop;

exports.getStops = stops.getStops;
exports.getStopsAsGeoJSON = stops.getStopsAsGeoJSON;
exports.getStopsByStopCode = stops.getStopsByStopCode;
exports.getStopsByStopCodeAsGeoJSON = stops.getStopsByStopCodeAsGeoJSON;
exports.getStopsByRoute = stops.getStopsByRoute;
exports.getStopsByRouteAsGeoJSON = stops.getStopsByRouteAsGeoJSON;
exports.getStopsByDistance = stops.getStopsByDistance;
exports.getStopsByDistanceAsGeoJSON = stops.getStopsByDistanceAsGeoJSON;

exports.getStoptimesByTrip = stopTimes.getStoptimesByTrip;
exports.getStoptimesByStop = stopTimes.getStoptimesByStop;

exports.getTripsByRouteAndDirection = trips.getTripsByRouteAndDirection;
exports.getDirectionsByRoute = trips.getDirectionsByRoute;

exports.getShapes = shapes.getShapes;
exports.getShapesAsGeoJSON = shapes.getShapesAsGeoJSON;
exports.getShapesByRoute = shapes.getShapesByRoute;
exports.getShapesByRouteAsGeoJSON = shapes.getShapesByRouteAsGeoJSON;

exports.getCalendars = calendars.getCalendars;
exports.getCalendarsByService = calendars.getCalendarsByService;

exports.getCalendarDatesByService = calendarDates.getCalendarDatesByService;

exports.getFeedInfo = feedInfo.getFeedInfo;

exports.getFareAttributesById = fareAttributes.getFareAttributesById;

exports.getFareRulesByRouteId = fareRules.getFareRulesByRouteId;

exports.getStopAttributes = stopAttributes.getStopAttributes;

exports.getTimetablesByAgency = timetables.getTimetablesByAgency;
exports.getTimetable = timetables.getTimetable;

exports.getTimetableStopOrders = timetableStopOrder.getTimetableStopOrders;

exports.getTimetablePagesByAgency = timetablePages.getTimetablePagesByAgency;
exports.getTimetablePage = timetablePages.getTimetablePage;
