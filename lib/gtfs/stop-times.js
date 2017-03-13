const _ = require('lodash');
const async = require('async');
const moment = require('moment');

const Calendar = require('../../models/calendar');
const StopTime = require('../../models/stop-time');
const Trip = require('../../models/trip');

/*
 * Returns an array of stoptimes for the `tripId` specified
 */
exports.getStoptimesByTrip = (agencyKey, tripId, cb) => {
  return StopTime
    .find({
      agency_key: agencyKey,
      trip_id: tripId
    })
    .sort({stop_sequence: 1})
    .exec(cb);
};

/*
 * Returns an array of stoptimes for the `agencyKey`, `routeId`, `stopId`
 * and `directionId` specified
 */
exports.getStoptimesByStop = (agencyKey, routeId, stopId, directionId, cb) => {
  if (_.isFunction(directionId)) {
    cb = directionId;
    directionId = undefined;
  }

  const serviceIds = [];
  const tripIds = [];
  const times = [];

  // Find service_id that matches todays date
  async.series([
    checkFields,
    findServices,
    findTrips,
    findTimes
  ], err => {
    if (err) {
      return cb(err);
    }

    cb(null, times);
  });

  function checkFields(cb) {
    if (agencyKey === undefined) {
      cb(new Error('No agencyKey specified'), 'fields');
    } else if (stopId === undefined) {
      cb(new Error('No stopId specified'), 'fields');
    } else if (routeId === undefined) {
      cb(new Error('No routeId specified'), 'fields');
    } else {
      cb();
    }
  }

  function findServices(cb) {
    const todayFormatted = moment().format('YYYYMMDD');
    const query = {
      agency_key: agencyKey
    };

    // Build query
    query[moment().format('dddd').toLowerCase()] = 1;

    Calendar
      .find(query)
      .where('start_date').lte(todayFormatted)
      .where('end_date').gte(todayFormatted)
      .exec()
      .then(services => {
        if (!services || services.length === 0) {
          throw new Error('No Service for this date');
        }

        services.forEach(service => {
          serviceIds.push(service.service_id);
        });
        cb();
      })
      .catch(cb);
  }

  function findTrips(cb) {
    const query = {
      agency_key: agencyKey,
      route_id: routeId
    };

    if (directionId !== undefined) {
      query.direction_id = directionId;
    } // else match all directionIds

    Trip
      .find(query)
      .where('service_id').in(serviceIds)
      .exec()
      .then(trips => {
        if (!trips || trips.length === 0) {
          throw new Error('No trips for this date');
        }

        trips.forEach(trip => {
          tripIds.push(trip.trip_id);
        });
        cb();
      })
      .catch(cb);
  }

  function findTimes(cb) {
    const query = {
      agency_key: agencyKey,
      stop_id: stopId
    };

    // Limit query to 1000 stopTimes.
    const stopTimesLimit = 1000;

    StopTime
      .find(query)
      .where('trip_id').in(tripIds)
      .sort('departure_time')
      .limit(stopTimesLimit)
      .exec()
      .then(stopTimes => {
        if (!stopTimes || stopTimes.length === 0) {
          throw new Error('No times available for this stop on this date');
        }

        stopTimes.forEach(stopTime => {
          times.push(stopTime.departure_time);
        });
        cb();
      })
      .catch(cb);
  }
};
