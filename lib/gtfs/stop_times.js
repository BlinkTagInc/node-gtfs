const _ = require('lodash');
const async = require('async');
const moment = require('moment');

const Calendar = require('../../models/Calendar');
const StopTime = require('../../models/StopTime');
const Trip = require('../../models/Trip');

/*
 * Returns an array of stoptimes for the `trip_id` specified
 */
exports.getStoptimesByTrip = (agency_key, trip_id, cb) => {
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
exports.getStoptimesByStop = (agency_key, route_id, stop_id, direction_id, cb) => {
  const numOfTimes = 1000;
  //this is dumb but no calls to getTimesByStop() seem
  //to want to give it a numOfTimes argument. 1000 is probably at least 10x
  //more times than will be returned.

  if (_.isFunction(direction_id)) {
    cb = direction_id;
    direction_id = undefined;
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
      cb();
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
        return cb();
      });
  }

  function findTrips(cb) {
    const query = {
      agency_key,
      route_id
    };

    if (direction_id !== undefined) {
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
        return cb();
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
        return cb();
      });
  }
};
