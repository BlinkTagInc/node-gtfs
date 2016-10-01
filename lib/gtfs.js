const _ = require('lodash');
const async = require('async');
const moment = require('moment');
const mongoose = require('mongoose');
const utils = require('./utils');

const config = utils.loadConfig();

mongoose.Promise = global.Promise;
const db = mongoose.connect(config.mongo_url);

// TODO: Make endpoints for FareAttribute, FareRule, Frequencies and Transfer

const Agency = require('../models/Agency');
const Calendar = require('../models/Calendar');
const CalendarDate = require('../models/CalendarDate');
const FareAttribute = require('../models/FareAttribute');
const FareRule = require('../models/FareRule');
const FeedInfo = require('../models/FeedInfo');
const Frequencies = require('../models/Frequencies');
const Route = require('../models/Route');
const Shape = require('../models/Shape');
const Stop = require('../models/Stop');
const StopTime = require('../models/StopTime');
const Transfer = require('../models/Transfer');
const Trip = require('../models/Trip');
const Timetable = require('../models/Timetable');
const TimetablePage = require('../models/TimetablePage');
const TimetableStopOrder = require('../models/TimetableStopOrder');


function findStop(stopData, cb) {
  return Stop.findOne({
    stop_id: stopData.stop_id
  })
  .exec((err, stop) => {
    if (err) return cb(err);
    cb(null, [stop.stop_lat, stop.stop_lon]);
  });
}


function findStops(pattern, cb) {
  async.map(pattern, findStop, cb);
}


function findStopTimes(trip_id, cb) {
  return StopTime.find({
    trip_id: trip_id
  })
  .sort('stop_sequence')
  .exec(cb);
}


function handleError(err) {
  console.error(err || 'Unknown Error');
  process.exit(1);
}


/*
 * Returns an array of all agencies
 */
exports.agencies = function(cb) {
  return Agency.find({}).exec(cb);
};


/*
 * Returns an agency
 */
exports.getAgency = function(agency_key, agency_id, cb) {
  if (_.isFunction(agency_id)) {
    cb = agency_id;
    agency_id = null;
  }

  const query = {
    agency_key
  };

  if (agency_id !== null) {
    query.agency_id = agency_id;
  }

  return Agency.findOne(query).exec(cb);
};


/*
 * Returns an array of agencies within a `radius` of the `lat`, `lon` specified
 */
exports.getAgenciesByDistance = function(lat, lon, radius, cb) {
  if (_.isFunction(radius)) {
    cb = radius;
    radius = 25; // default is 25 miles
  }

  return Agency
    .where('agency_center')
    .near(parseFloat(lon), parseFloat(lat))
    .maxDistance(utils.milesToDegrees(radius))
    .exec(cb);
};


/*
 * Returns an array of routes for the `agency_key` specified and `agency_id`
 * if specified
 */
exports.getRoutesByAgency = function(agency_key, agency_id, cb) {
  if (_.isFunction(agency_id)) {
    cb = agency_id;
    agency_id = null;
  }

  const query = {
    agency_key
  };

  if (agency_id !== null) {
    query.agency_id = agency_id;
  }

  return Route.find(query).exec(cb);
};


/*
 * Returns a route for the `route_id` specified
 */
exports.getRoutesById = function(agency_key, route_id, cb) {
  return Route.findOne({
    agency_key,
    route_id
  }).exec(cb);
};


/*
 * Returns an array of routes within a `radius` of the `lat`, `lon` specified
 */
exports.getRoutesByDistance = function(lat, lon, radius, cb) {
  if (_.isFunction(radius)) {
    cb = radius;
    radius = 1; //default is 1 mile
  }

  lat = parseFloat(lat);
  lon = parseFloat(lon);

  const radiusInDegrees = Math.round(radius / 69 * 100000) / 100000;
  let stop_ids;
  let trip_ids;
  let route_ids;
  let routes;

  async.series([
    getStopsNearby,
    getTrips,
    getRoutes,
    lookupRoutes
  ], (err) => {
    cb(err, routes);
  });

  function getStopsNearby(cb) {
    Stop
      .where('loc')
      .near(lon, lat).maxDistance(radiusInDegrees)
      .exec((err, stops) => {
        if (err) return cb(err);

        if (stops.length) {
          stop_ids = stops.reduce((memo, stop) => {
            if (stop.stop_id) {
              memo.push(stop.stop_id);
            }
            return memo;
          }, []);
        }
        cb(null, 'stops');
      });
  }

  function getTrips(cb) {
    StopTime
      .distinct('trip_id')
      .where('stop_id').in(stop_ids)
      .exec((err, results) => {
        if (err) return cb(err);

        trip_ids = results;
        cb(null, 'trips');
      });
  }

  function getRoutes(cb) {
    Trip
      .distinct('route_id')
      .where('trip_id').in(trip_ids)
      .exec((err, results) => {
        if (err) return cb(err);

        route_ids = results;
        cb(null, 'routes');
      });
  }

  function lookupRoutes(cb) {
    Route
      .where('route_id').in(route_ids)
      .exec((err, results) => {
        if (err) return cb(err);

        routes = results;
        cb(null, 'lookup');
      });
  }
};


/*
 * Returns an array of routes serving the `agency_key` and `stop_id` specified
 */
exports.getRoutesByStop = function(agency_key, stop_id, cb) {
  let trip_ids;
  let route_ids;
  let routes;

  async.series([
    getTrips,
    getRoutes,
    lookupRoutes
  ], (err) => {
    cb(err, routes);
  });

  function getTrips(cb) {
    StopTime
      .find({
        agency_key,
        stop_id: stop_id
      })
      .distinct('trip_id')
      .exec((err, results) => {
        if (err) return cb(err);

        if (!results || !results.length) {
          return cb(new Error('No routes for the given stop'), 'trips');
        }
        trip_ids = results;
        cb(null, 'trips');
      });
  }

  function getRoutes(cb) {
    Trip
      .distinct('route_id')
      .where('trip_id').in(trip_ids)
      .exec((err, results) => {
        if (err) return cb(err);

        if (!results || !results.length) {
          return cb(new Error('No routes for the given stop'), 'routes');
        }

        route_ids = results;
        return cb(null, 'routes');
      });
  }

  function lookupRoutes(cb) {
    Route
      .where('route_id').in(route_ids)
      .exec((err, results) => {
        if (err) return cb(err);

        if (!results || !results.length) {
          return cb(new Error('No information for routes'), 'lookup');
        }

        routes = results;
        return cb(null, 'lookup');
      });
  }
};


/*
 * Returns an array of stops for the `agency_key` specified, optionally
 * limited to the `stop_ids` specified
 */
exports.getStops = function(agency_key, stop_ids, cb) {
  if (_.isFunction(stop_ids)) {
    cb = stop_ids;
    stop_ids = null;
  }

  const query = {
    agency_key
  };

  if (stop_ids !== null) {
    if (!_.isArray(stop_ids)) {
      stop_ids = [stop_ids];
    }

    query.stop_id = {
      $in: stop_ids
    };
  }

  return Stop.find(query).exec(cb);
};


/*
 * Returns an array of stops along the `route_id` for the `agency_key` and `direction_id` specified
 */
exports.getStopsByRoute = function(agency_key, route_id, direction_id, cb) {
  if (_.isFunction(direction_id)) {
    cb = direction_id;
    direction_id = null;
  }

  const longestTrip = {};
  const stops = {};
  const trip_ids = {};
  const direction_ids = [];

  async.series([
    getTrips,
    getStopTimes,
    getStops
  ], (err) => {
    if (err) return cb(err);

    // transform results based on whether direction_id was
    // - specified (return stops for a direction)
    // - or not specified (return stops for all directions)
    let results;
    if (direction_id !== null && direction_id !== undefined) {
      results = stops[direction_id] || [];
    } else {
      results = _.map(stops, (stops, direction_id) => {
        return {
          direction_id,
          stops: stops || []
        };
      });
    }
    cb(null, results);
  });

  function getTrips(cb) {
    const query = {
      agency_key,
      route_id
    };
    if (direction_id !== null && direction_id !== undefined) {
      query.direction_id = direction_id;
    } // else match all direction_ids

    Trip.find(query).exec((err, trips) => {
      if (err) return cb(err);

      trips.forEach((trip) => {
        if (direction_ids.indexOf(trip.direction_id) < 0) {
          direction_ids.push(trip.direction_id);
        }
        if (!trip_ids[trip.direction_id]) {
          trip_ids[trip.direction_id] = [];
        }
        trip_ids[trip.direction_id].push(trip.trip_id);
      });
      cb();
    });
  }

  function getStopTimes(cb) {
    async.forEach(
      direction_ids,
      (direction_id, cb) => {
        if (!trip_ids[direction_id]) {
          return cb();
        }

        async.forEach(
          trip_ids[direction_id],
          (trip_id, cb) => {
            StopTime.find({
              agency_key,
              trip_id
            },
            null, {
              sort: 'stop_sequence'
            },
            (err, stopTimes) => {
              if (err) return cb(err);

              //compare to longest trip for given direction_id to see if trip length is longest for given direction
              if (!longestTrip[direction_id]) longestTrip[direction_id] = [];
              if (stopTimes.length && stopTimes.length > longestTrip[direction_id].length) {
                longestTrip[direction_id] = stopTimes;
              }
              cb();
            });
          },
          () => {
            cb();
          }
        );
      },
      () => {
        cb(null, 'times');
      }
    );
  }

  function getStops(cb) {
    async.forEach(
      direction_ids,
      (direction_id, cb) => {
        if (!longestTrip[direction_id]) return cb();
        async.forEachSeries(
          longestTrip[direction_id],
          (stopTime, cb) => {
            Stop.findOne({
              agency_key,
              stop_id: stopTime.stop_id
            },
            (err, stop) => {
              if (err) return cb(err);

              if (!stops[direction_id]) {
                stops[direction_id] = [];
              }
              stops[direction_id].push(stop);
              cb();
            });
          },
          cb
        );
      },
      (err) => {
        if (err) {
          return cb(new Error('No stops found'), 'stops');
        }
        cb(null, 'stops');
      });
  }
};


/*
 * Returns an array of stops within a `radius` of the `lat`, `lon` specified
 */
exports.getStopsByDistance = function(lat, lon, radius, cb) {
  if (_.isFunction(radius)) {
    cb = radius;
    radius = 1; //default is 1 mile
  }

  lat = parseFloat(lat);
  lon = parseFloat(lon);

  const radiusInDegrees = Math.round(radius / 69 * 100000) / 100000;

  return Stop
    .where('loc')
    .near(lon, lat).maxDistance(radiusInDegrees)
    .exec(cb);
};


/*
 * Returns an array of stoptimes for the `trip_id` specified
 */
exports.getStoptimesByTrip = function(agency_key, trip_id, cb) {
  return StopTime
    .find({
      agency_key,
      trip_id
    })
    .sort({stop_sequence: 1})
    .exec(cb);
};


/*
 * Returns an array of stoptimes for the `agency_key`, `route_id`, `stop_id`
 * and `direction_id` specified
 */
exports.getStoptimesByStop = function(agency_key, route_id, stop_id, direction_id, cb) {
  const numOfTimes = 1000;
  //this is dumb but no calls to getTimesByStop() seem
  //to want to give it a numOfTimes argument. 1000 is probably at least 10x
  //more times than will be returned.

  if (_.isFunction(direction_id)) {
    cb = direction_id;
    direction_id = null; //default is ~ 1/4 mile
  }

  const service_ids = [];
  const trip_ids = [];
  const times = [];

  // Find service_id that matches todays date
  async.series([
    checkFields,
    findServices,
    findTrips,
    findTimes
  ], (err) => {
    if (err) return cb(err);

    cb(null, times);
  });

  function checkFields(cb) {
    if (!agency_key) {
      cb(new Error('No agency_key specified'), 'fields');
    } else if (!stop_id) {
      cb(new Error('No stop_id specified'), 'fields');
    } else if (!route_id) {
      cb(new Error('No route_id specified'), 'fields');
    } else {
      cb(null, 'fields');
    }
  }

  function findServices(cb) {
    const todayFormatted = moment().format('YYYYMMDD');
    const query = {
      agency_key
    };

    //build query
    query[moment().format('dddd').toLowerCase()] = 1;

    Calendar
      .find(query)
      .where('start_date').lte(todayFormatted)
      .where('end_date').gte(todayFormatted)
      .exec(function(err, services) {
        if (err) return cb(err);

        if (!services || !services.length) {
          return cb(new Error('No Service for this date'), 'services');
        }

        services.forEach((service) => {
          service_ids.push(service.service_id);
        });
        return cb(null, 'services');
      });
  }

  function findTrips(cb) {
    const query = {
      agency_key,
      route_id
    };

    if (direction_id !== null && direction_id !== undefined) {
      query.direction_id = direction_id;
    } // else match all direction_ids

    Trip
      .find(query)
      .where('service_id').in(service_ids)
      .exec((err, trips) => {
        if (err) return cb(err);

        if (!trips || !trips.length) {
          return cb(new Error('No trips for this date'), 'trips');
        }

        trips.forEach((trip) => {
          trip_ids.push(trip.trip_id);
        });
        return cb(null, 'trips');
      });
  }

  function findTimes(cb) {
    const query = {
      agency_key,
      stop_id
    };

    StopTime
      .find(query)
      .where('trip_id').in(trip_ids)
      .sort('departure_time')
      .limit(numOfTimes)
      .exec((err, stopTimes) => {
        if (err) return cb(err);

        if (!stopTimes || !stopTimes.length) {
          return cb(new Error('No times available for this stop on this date'), 'times');
        }

        stopTimes.forEach((stopTime) => {
          times.push(stopTime.departure_time);
        });
        return cb(null, 'times');
      });
  }
};


/*
 * Returns an array of trips for the `agency_key`, `route_id` and
 * `direction_id` specified
 */
exports.getTripsByRouteAndDirection = function(agency_key, route_id, direction_id, service_ids, cb) {
  if (_.isFunction(service_ids)) {
    cb = service_ids;
    service_ids = null;
  }

  const query = {
    agency_key,
    route_id
  };

  if (_.includes([0, 1], direction_id)) {
    query.direction_id = direction_id;
  } else {
    query.direction_id = {
      $nin: [0, 1]
    };
  }

  if (service_ids && service_ids.length) {
    query.service_id = {
      $in: service_ids
    };
  }

  return Trip.find(query).exec(cb);
};


/*
 * Returns an object of
 * {northData: "Headsign north", southData: "Headsign south"}
 * for the `agency_key` and `route_id` specified
 */
exports.findBothDirectionNames = function(agency_key, route_id, cb) {
  function findDirectionName(agency_key, route_id, direction_id, cb) {
    const query = {
      agency_key,
      route_id,
      direction_id
    };

    Trip
      .find(query)
      .limit(1)
      .exec(function(err, trips) {
        if (err) return cb(err);

        if (!trips || !trips.length) {
          return cb(new Error('No matring trips found'));
        }

        cb(null, trips[0].trip_headsign);
      });
  }

  findDirectionName(agency_key, route_id, 0, (err, northData) => {
    if (err) return cb(err);
    findDirectionName(agency_key, route_id, 1, (err, southData) => {
      if (err) return cb(err);

      const loc = {
        northData,
        southData
      };
      cb(null, loc);
    });
  });
};


/*
 * Returns an array of shapes for the `agency_key`, `route_id` and
 * `direction_id` specified
 */
exports.getShapesByRoute = function(agency_key, route_id, direction_id, service_ids, cb) {
  if (_.isFunction(direction_id)) {
    cb = direction_id;
    direction_id = null;
    service_ids = null;
  }

  if (_.isFunction(service_ids)) {
    cb = service_ids;
    service_ids = null;
  }

  let shape_ids;
  const shapes = [];

  async.series([getShapeIds, getShapes], () => {
    cb(null, shapes);
  });

  function getShapeIds(cb) {
    const query = {
      agency_key,
      route_id
    };
    if (direction_id !== null && direction_id !== undefined) {
      query.direction_id = direction_id;
    } // else match all direction_ids

    if (service_ids && service_ids.length) {
      query.service_id = {
        $in: service_ids
      };
    }

    Trip
      .find(query)
      .distinct('shape_id', function(err, results) {
        if (err) return cb(err);

        if (!results || !results.length) {
          return cb(new Error('No trips with shapes.'), 'trips');
        }

        // Remove empty strings
        shape_ids = _.compact(results);

        return cb(null, 'shape_ids');
      });
  }

  function getShapes(cb) {
    async.forEach(shape_ids, (shape_id, cb) => {
      Shape.find({
        agency_key,
        shape_id
      }).sort({'shape_pt_sequence': 1})
      .exec((err, shape_pts) => {
        if (err) return cb(err);

        if (!shape_pts || !shape_pts.length) {
          return cb(new Error('No shapes with shape_id.'), 'shape_pts');
        }

        shapes.push(shape_pts);
        return cb(null, 'shape_pts');
      });
    }, function() {
      cb(null, 'shapes');
    });
  }
};


/*
 * Returns an array of coordinates for the `agency_key`, and `route_id`
 * specified
 */
exports.getCoordinatesByRoute = function(agency_key, route_id, cb) {
  module.exports.getShapesByRoute(agency_key, route_id, (err, shapes) => {
    if (err) {
      Trip.find({
        agency_key,
        route_id
      })
      .distinct('trip_id', (err, results) => {
        if (err) return cb(err);

        results = _.compact(results);

        async.map(results, findStopTimes, (err, stopTimes) => {
          if (err) return cb(err);

          async.map(stopTimes, findStops, cb);
        });
      });
    }

    const coordinates = _.map(shapes, (shape) => _.map(shape, (p) => p.loc));
    cb(null, coordinates);
  });
};


/*
 * Returns an array of calendars, optionally bounded by start_date and
 * end_date
 */
exports.getCalendars = function(agency_key, start_date, end_date, monday, tuesday, wednesday, thursday, friday, saturday, sunday, cb) {
  const daysOfWeek = [];
  let daysOfWeekQuery;

  if (monday) {
    daysOfWeek.push({monday: 1});
  }
  if (tuesday) {
    daysOfWeek.push({tuesday: 1});
  }
  if (wednesday) {
    daysOfWeek.push({wednesday: 1});
  }
  if (thursday) {
    daysOfWeek.push({thursday: 1});
  }
  if (friday) {
    daysOfWeek.push({friday: 1});
  }
  if (saturday) {
    daysOfWeek.push({saturday: 1});
  }
  if (sunday) {
    daysOfWeek.push({sunday: 1});
  }

  if (daysOfWeek.length) {
    daysOfWeekQuery = {$or: daysOfWeek};
  } else {
    daysOfWeekQuery = {$and: [
      {monday: 0},
      {tuesday: 0},
      {wednesday: 0},
      {thursday: 0},
      {friday: 0},
      {saturday: 0},
      {sunday: 0}
    ]};
  }

  return Calendar.find({
    $and: [
      {agency_key},
      {$and: [
        {start_date: {$lt: end_date}},
        {end_date: {$gte: start_date}}
      ]},
      daysOfWeekQuery
    ]
  }).exec(cb);
};


/*
 * Returns an array of calendars for the `service_ids` specified
 */
exports.getCalendarsByService = function(service_ids, cb) {
  if (!_.isArray(service_ids)) {
    service_ids = [service_ids];
  }

  return Calendar.find({
    service_id: {
      $in: service_ids
    }
  }).exec(cb);
};


/*
 * Returns an array of calendarDates for the `service_ids` specified
 */
exports.getCalendarDatesByService = function(service_ids, cb) {
  if (!_.isArray(service_ids)) {
    service_ids = [service_ids];
  }

  return CalendarDate.find({
    service_id: {
      $in: service_ids
    }
  }).exec(cb);
};


/*
 * Returns feed_info for the agency_key specified
 */
exports.getFeedInfo = function(agency_key, cb) {
  return FeedInfo.findOne({
    agency_key
  }).exec(cb);
};


/*
 * Returns an array of timetables for the `agency_key` specified
 */
exports.getTimetablesByAgency = function(agency_key, cb) {
  return Timetable.find({
    agency_key
  }).exec(cb);
};


/*
 * Returns an array timetable objects matching the `timetable_id` specified
 */
exports.getTimetable = function(agency_key, timetable_id, cb) {
  return Timetable.find({
    agency_key,
    timetable_id
  }).exec(cb);
};


/*
 * Returns an array of timetable_stop_order objects matching the
 * `timetable_id` specified
 */
exports.getTimetableStopOrders = function(agency_key, timetable_id, cb) {
  return TimetableStopOrder.find({
    agency_key,
    timetable_id
  }, null, {
    sort: 'stop_sequence'
  }).exec(cb);
};


/*
 * Returns an array of timetable_pages for the `agency_key` specified
 */
exports.getTimetablePagesByAgency = function(agency_key, cb) {
  return TimetablePage.find({
    agency_key
  }).exec(cb);
};


/*
 * Returns an array timetable_pages matching the `timetable_page_id` specified
 */
exports.getTimetablePage = function(agency_key, timetable_page_id, cb) {
  return TimetablePage.findOne({
    agency_key,
    timetable_page_id
  }).exec(cb);
};
