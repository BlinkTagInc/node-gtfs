var _ = require('lodash');
var async = require('async');
var mongoose = require('mongoose');
var utils = require('./utils');

var config = {};

//load config.js
try {
  config = require('../config.js');
} catch(e) {
  try {
    config = require('../config-sample.js');
  } catch(e) {
    handleError(new Error('Cannot find config.js'));
  }
}

var db = mongoose.connect(config.mongo_url);

require('../models/Agency');
require('../models/Calendar');
require('../models/CalendarDate');
require('../models/FareAttribute');
require('../models/FareRule');
require('../models/FeedInfo');
require('../models/Frequencies');
require('../models/Route');
require('../models/Shape');
require('../models/Stop');
require('../models/StopTime');
require('../models/Transfer');
require('../models/Trip');
require('../models/Timetable');
require('../models/TimetableStopOrder');


var Agency = db.model('Agency');
var Calendar = db.model('Calendar');
var CalendarDate = db.model('CalendarDate');
var FeedInfo = db.model('FeedInfo');
var Route = db.model('Route');
var Shape = db.model('Shape');
var Stop = db.model('Stop');
var StopTime = db.model('StopTime');
var Trip = db.model('Trip');
var Timetable = db.model('Timetable');
var TimetableStopOrder = db.model('TimetableStopOrder');


module.exports = {

  /*
   * Returns an array of all agencies
   */
  agencies: function(cb) {
    Agency.find({}, cb);
  },


  /*
   * Returns an agency
   */
  getAgency: function(agency_key, agency_id, cb) {
    if (_.isFunction(agency_id)) {
      cb = agency_id;
      agency_id = null;
    }

    if (agency_id === null) {
      Agency.findOne({
        agency_key: agency_key
      }, cb);
    } else {
      Agency.findOne({
        agency_key: agency_key,
        agency_id: agency_id
      }, cb);
    }
  },


  /*
   * Returns an array of agencies within a `radius` of the `lat`, `lon` specified
   */
  getAgenciesByDistance: function(lat, lon, radius, cb) {
    if (_.isFunction(radius)) {
      cb = radius;
      radius = 25; // default is 25 miles
    }

    Agency
      .where('agency_center')
      .near(parseFloat(lon), parseFloat(lat))
      .maxDistance(utils.milesToDegrees(radius))
      .exec(cb);
  },


  /*
   * Returns an array of routes for the `agency_key` specified and `agency_id`
   * if specified
   */
  getRoutesByAgency: function(agency_key, agency_id, cb) {
    if (_.isFunction(agency_id)) {
      cb = agency_id;
      agency_id = null;
    }

    if (agency_id === null) {
      Route.find({
        agency_key: agency_key
      }, cb);
    } else {
      Route.find({
        agency_key: agency_key,
        agency_id: agency_id
      }, cb);
    }
  },


  /*
   * Returns a route for the `route_id` specified
   */
  getRoutesById: function(agency_key, route_id, cb) {
    Route.findOne({
      agency_key: agency_key,
      route_id: route_id
    }, cb);
  },


  /*
   * Returns an array of routes within a `radius` of the `lat`, `lon` specified
   */
  getRoutesByDistance: function(lat, lon, radius, cb) {
    if (_.isFunction(radius)) {
      cb = radius;
      radius = 1; //default is 1 mile
    }

    lat = parseFloat(lat);
    lon = parseFloat(lon);

    var radiusInDegrees = Math.round(radius / 69 * 100000) / 100000;
    var stop_ids = [];
    var trip_ids = [];
    var route_ids = [];
    var routes = [];

    async.series([
      getStopsNearby,
      getTrips,
      getRoutes,
      lookupRoutes
    ], function(e) {
      cb(e, routes);
    });

    function getStopsNearby(cb) {
      Stop
        .where('loc')
        .near(lon, lat).maxDistance(radiusInDegrees)
        .exec(function(e, stops) {
          if (stops.length) {
            stops.forEach(function(stop) {
              if (stop.stop_id) {
                stop_ids.push(stop.stop_id);
              }
            });
            cb(e, 'stops');
          } else {
            cb(new Error('No stops within ' + radius + ' miles'), 'stops');
          }
        });
    }

    function getTrips(cb) {
      StopTime
        .distinct('trip_id')
        .where('stop_id').in(stop_ids)
        .exec(function(e, results) {
          trip_ids = results;
          cb(e, 'trips');
        });
    }

    function getRoutes(cb) {
      Trip
        .distinct('route_id')
        .where('trip_id').in(trip_ids)
        .exec(function(e, results) {
          if (results.length) {
            route_ids = results;
            cb(null, 'routes');
          } else {
            cb(new Error('No routes to any stops within ' + radius + ' miles'), 'routes');
          }
        });
    }

    function lookupRoutes(cb) {
      Route
        .where('route_id').in(route_ids)
        .exec(function(e, results) {
          if (results.length) {
            routes = results;
            cb(null, 'lookup');
          } else {
            cb(new Error('No information for routes'), 'lookup');
          }
        });
    }
  },


  /*
   * Returns an array of routes serving the `agency_key` and `stop_id` specified
   */
  getRoutesByStop: function(agency_key, stop_id, cb) {
    var trip_ids = [];
    var route_ids = [];
    var routes = [];

    async.series([
      getTrips,
      getRoutes,
      lookupRoutes
    ], function(e) {
      cb(e, routes);
    });

    function getTrips(cb) {
      StopTime
        .find({
          agency_key: agency_key,
          stop_id: stop_id
        })
        .distinct('trip_id')
        .exec(function(e, results) {
          if (!results.length) {
            return cb(new Error('No routes for the given stop'), 'trips');
          }
          trip_ids = results;
          cb(e, 'trips');
        });
    }

    function getRoutes(cb) {
      Trip
        .distinct('route_id')
        .where('trip_id').in(trip_ids)
        .exec(function(e, results) {
          if (results.length) {
            route_ids = results;
            cb(null, 'routes');
          } else {
            return cb(new Error('No routes for the given stop'), 'routes');
          }
        });
    }

    function lookupRoutes(cb) {
      Route
        .where('route_id').in(route_ids)
        .exec(function(e, results) {
          if (results.length) {
            routes = results;
            cb(null, 'lookup');
          } else {
            cb(new Error('No information for routes'), 'lookup');
          }
        });
    }
  },


  /*
   * Returns an array of stops matching the `stop_ids` specified
   */
  getStops: function(agency_key, stop_ids, cb) {
    if (!_.isArray(stop_ids)) {
      stop_ids = [stop_ids];
    }

    Stop.find({
      agency_key: agency_key,
      stop_id: {
        $in: stop_ids
      }
    }, cb);
  },


  /*
   * Returns an array of stops along the `route_id` for the `agency_key` and `direction_id` specified
   */
  getStopsByRoute: function(agency_key, route_id, direction_id, cb) {
    if (_.isFunction(direction_id)) {
      cb = direction_id;
      direction_id = null;
    }

    var longestTrip = {};
    var stops = {};
    var trip_ids = {};
    var direction_ids = [];

    async.series([
      getTrips,
      getStopTimes,
      getStops
    ], function(e) {
      // transform results based on whether direction_id was
      // - specified (return stops for a direction)
      // - or not specified (return stops for all directions)
      var results = [];
      if (direction_id !== null && direction_id !== undefined) {
        results = stops[direction_id] || [];
      } else {
        _.each(stops, function(stops, direction_id) {
          results.push({
            direction_id: direction_id,
            stops: stops || []
          });
        });
      }
      cb(e, results);
    });

    function getTrips(cb) {
      var query = {
        agency_key: agency_key,
        route_id: route_id
      };
      if (direction_id !== null && direction_id !== undefined) {
        query.direction_id = direction_id;
      } // else match all direction_ids

      Trip.find(query).exec(function(err, trips){
        if (!trips || trips.length == 0) {
          return cb(new Error('Invalid agency_key or route_id'), 'trips');
        }

        trips.forEach(function(trip){
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
        function(direction_id, cb) {
          if (!trip_ids[direction_id]) {
            return cb();
          }

          async.forEach(
            trip_ids[direction_id],
            function(trip_id, cb) {
              StopTime.find({
                agency_key: agency_key,
                trip_id: trip_id
              },
              null, {
                sort: 'stop_sequence'
              },
              function(e, stopTimes) {
                //compare to longest trip for given direction_id to see if trip length is longest for given direction
                if (!longestTrip[direction_id]) longestTrip[direction_id] = [];
                if (stopTimes.length && stopTimes.length > longestTrip[direction_id].length) {
                  longestTrip[direction_id] = stopTimes;
                }
                cb();
              });
            }.bind(direction_id),
            function() {
              cb();
            }
          );
        },
        function() {
          cb(null, 'times');
        }
      );
    }

    function getStops(cb) {
      async.forEach(
        direction_ids,
        function(direction_id, cb) {
          if (!longestTrip[direction_id]) return cb();
          async.forEachSeries(
            longestTrip[direction_id],
            function(stopTime, cb) {
              Stop.findOne({
                agency_key: agency_key,
                stop_id: stopTime.stop_id
              },
              function(e, stop) {
                if (!stops[direction_id]) stops[direction_id] = [];
                stops[direction_id].push(stop);
                cb();
              });
            }.bind(direction_id),
            function(e) {
              cb(e);
            }
          );
        },
        function(e) {
          if (e) {
            cb(new Error('No stops found'), 'stops');
          } else {
            cb(null, 'stops');
          }
        });
    }
  },


  /*
   * Returns an array of stops within a `radius` of the `lat`, `lon` specified
   */
  getStopsByDistance: function(lat, lon, radius, cb) {
    if (_.isFunction(radius)) {
      cb = radius;
      radius = 1; //default is 1 mile
    }

    lat = parseFloat(lat);
    lon = parseFloat(lon);

    var radiusInDegrees = Math.round(radius / 69 * 100000) / 100000;

    Stop
      .where('loc')
      .near(lon, lat).maxDistance(radiusInDegrees)
      .exec(function(e, results) {
        cb(e, results);
      });
  },


  /*
   * Returns an array of stoptimes for the `trip_id` specified
   */
  getStoptimesByTrip: function(agency_key, trip_id, cb) {
    StopTime
      .find({
        agency_key: agency_key,
        trip_id: trip_id
      })
      .sort({stop_sequence: 1})
      .exec(cb);
  },


  /*
   * Returns an array of stoptimes for the `agency_key`, `route_id`, `stop_id`
   * and `direction_id` specified
   */
  getStoptimesByStop: function(agency_key, route_id, stop_id, direction_id, cb) {
    var numOfTimes = 1000; //this is dumb but no calls to getTimesByStop() seem
    //to want to give it a numOfTimes argument. 1000 is probably at least 10x
    //more times than will be returned.

    if (_.isFunction(direction_id)) {
      cb = direction_id;
      direction_id = null; //default is ~ 1/4 mile
    }

    var today = new Date();
    var service_ids = [];
    var trip_ids = [];
    var times = [];

    // Find service_id that matches todays date
    async.series([
      checkFields,
      findServices,
      findTrips,
      findTimes
    ], function(e) {
      if (e) {
        cb(e, null);
      } else {
        cb(e, times);
      }
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
      var query = {
        agency_key: agency_key
      };
      var todayFormatted = utils.formatDay(today);

      //build query
      query[utils.getDayName(today).toLowerCase()] = 1;

      Calendar
        .find(query)
        .where('start_date').lte(todayFormatted)
        .where('end_date').gte(todayFormatted)
        .exec(function(e, services) {
          if (services.length) {
            services.forEach(function(service) {
              service_ids.push(service.service_id);
            });
            cb(null, 'services');
          } else {
            cb(new Error('No Service for this date'), 'services');
          }
        });
    }

    function findTrips(cb) {
      var query = {
        agency_key: agency_key,
        route_id: route_id
      };
      if (direction_id !== null && direction_id !== undefined) {
        query.direction_id = direction_id;
      } // else match all direction_ids

      Trip
        .find(query)
        .where('service_id').in(service_ids)
        .exec(function(e, trips) {
          if (trips.length) {
            trips.forEach(function(trip) {
              trip_ids.push(trip.trip_id);
            });
            cb(null, 'trips');
          } else {
            cb(new Error('No trips for this date'), 'trips');
          }
        });
    }

    function findTimes(cb) {
      var query = {
        agency_key: agency_key,
        stop_id: stop_id
      };

      StopTime
        .find(query)
        .where('trip_id').in(trip_ids)
        .sort('departure_time')
        .limit(numOfTimes)
        .exec(function(e, stopTimes) {
          if (stopTimes.length) {
            stopTimes.forEach(function(stopTime) {
              times.push(stopTime.departure_time);
            });
            cb(null, 'times');
          } else {
            cb(new Error('No times available for this stop on this date'), 'times');
          }
        });
    }
  },


  /*
   * Returns an array of trips for the `agency_key`, `route_id` and
   * `direction_id` specified
   */
  getTripsByRouteAndDirection: function(agency_key, route_id, direction_id, service_ids, cb) {
    var query = {
      agency_key: agency_key,
      route_id: route_id
    };

    if (_.contains([0, 1], direction_id)) {
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

    Trip.find(query, cb);
  },


  /*
   * Returns an object of
   * {northData: "Headsign north", southData: "Headsign south"}
   * for the `agency_key` and `route_id` specified
   */
  findBothDirectionNames: function(agency_key, route_id, cb) {
    var findDirectionName = function(agency_key, route_id, direction_id, cb) {
      var query = {
        agency_key: agency_key,
        route_id: route_id,
        direction_id: direction_id
      };

      Trip
        .find(query)
        .limit(1)
        .exec(function(e, trips) {
          cb(e, trips[0].trip_headsign);
        });
    };

    findDirectionName(agency_key, route_id, 0, function(e, northData) {
      if (e) return cb(e);
      findDirectionName(agency_key, route_id, 1, function(e, southData) {
        var ret = {
          northData: northData,
          southData: southData
        };
        cb(e, ret);
      });
    });
  },


  /*
   * Returns an array of shapes for the `agency_key`, `route_id` and
   * `direction_id` specified
   */
  getShapesByRoute: function(agency_key, route_id, direction_id, cb) {
    if (_.isFunction(direction_id)) {
      cb = direction_id;
      direction_id = null;
    }

    var shape_ids = [];
    var shapes = [];

    async.series([getShapeIds, getShapes], function(){
      cb(null, shapes);
    });

    function getShapeIds(cb) {
      var query = {
        agency_key: agency_key,
        route_id: route_id
      };
      if (direction_id !== null && direction_id !== undefined) {
        query.direction_id = direction_id;
      } // else match all direction_ids

      Trip
        .find(query)
        .distinct('shape_id', function(err, results) {
          // Remove empty strings
          results = _.compact(results);

          if (results.length) {
            shape_ids = results;
            cb(null, 'shape_ids');
          } else {
            cb(new Error('No trips with shapes.'), 'trips');
          }
        });
    }

    function getShapes(cb) {
      async.forEach(shape_ids, function(shape_id, cb) {
        Shape.find({
          agency_key: agency_key,
          shape_id: shape_id
        }, function(err, shape_pts) {
          if (shape_pts.length) {
            shapes.push(shape_pts);
            cb(null, 'shape_pts');
          } else {
            cb(new Error('No shapes with shape_id.'), 'shape_pts');
          }
        });
      }, function() {
        cb(null, 'shapes');
      });
    }
  },


  /*
   * Returns an array of coordinates for the `agency_key`, and `route_id`
   * specified
   */
  getCoordinatesByRoute: function(agency_key, route_id, cb) {
    var coordinates = [];

    module.exports.getShapesByRoute(agency_key, route_id, function(err, shapes) {
      if (err) {
        Trip.find({
          agency_key: agency_key,
          route_id: route_id
        })
        .distinct('trip_id', function(err, results) {
          results = _.compact(results);

          async.map(results, findStopTimes, function(err, stopTimes) {
            async.map(stopTimes, findStops, function(err, latlngs) {

              cb({
                usedStops: true
              }, latlngs);
            });
          });
        });
      }

      shapes.forEach(function(shape) {
        shape.sort(function(a, b) {
          return a.shape_pt_sequence - b.shape_pt_sequence;
        });
        var line = shape.map(function(shape_pt) {
          return shape_pt.loc;
        });
        coordinates.push(line);
      });

      cb(null, coordinates);
    });
  },


  /*
   * Returns an array of calendars, optionally bounded by start_date and
   * end_date
   */
  getCalendars: function(agency_key, start_date, end_date, monday, tuesday, wednesday, thursday, friday, saturday, sunday, cb) {

    var daysOfWeek = [];
    var daysOfWeekQuery = {};

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

    Calendar.find({
      $and: [
        {agency_key: agency_key},
        {$and: [
          {start_date: {$lt: end_date}},
          {end_date: {$gte: start_date}}
        ]},
        daysOfWeekQuery
      ]
    }, cb);
  },


  /*
   * Returns an array of calendars for the `service_ids` specified
   */
  getCalendarsByService: function(service_ids, cb) {
    if (!_.isArray(service_ids)) {
      service_ids = [service_ids];
    }

    Calendar.find({
      service_id: {
        $in: service_ids
      }
    }, cb);
  },


  /*
   * Returns an array of calendarDates for the `service_ids` specified
   */
  getCalendarDatesByService: function(service_ids, cb) {
    if (!_.isArray(service_ids)) {
      service_ids = [service_ids];
    }

    CalendarDate.find({
      service_id: {
        $in: service_ids
      }
    }, cb);
  },


  /*
   * Returns feed_info for the agency_key specified
   */
  getFeedInfo: function(agency_key, cb) {
    FeedInfo.findOne({
      agency_key: agency_key
    }, cb);
  },


  /*
   * Returns an array of timetables for the `agency_key` specified
   */
  getTimetablesByAgency: function(agency_key, cb) {
    Timetable.find({
      agency_key: agency_key
    }, cb);
  },


  /*
   * Returns an array timetable objects matching the `timetable_id` specified
   */
  getTimetable: function(agency_key, timetable_id, cb) {
    Timetable.find({
      agency_key: agency_key,
      timetable_id: timetable_id
    }, cb);
  },


  /*
   * Returns an array of timetable_stop_order objects matching the
   * `timetable_id` specified
   */
  getTimetableStopOrders: function(agency_key, timetable_id, cb) {
    TimetableStopOrder.find({
      agency_key: agency_key,
      timetable_id: timetable_id
    }, null, {
      sort: 'stop_sequence'
    }, cb);
  }
};


function findStop(stopData, cb) {
  Stop.findOne({
    stop_id: stopData.stop_id
  })
  .exec(function(e, stop) {
    cb(e, [stop.stop_lat, stop.stop_lon]);
  });
}


function findStops(pattern, cb) {
  async.map(pattern, findStop, cb);
}


function findStopTimes(trip_id, cb) {
  StopTime.find({
    trip_id: trip_id
  })
  .sort('stop_sequence')
  .exec(cb);
}


function handleError(e) {
  console.error(e || 'Unknown Error');
  process.exit(1);
}
