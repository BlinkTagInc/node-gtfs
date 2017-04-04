const _ = require('lodash');
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

  return new Promise(() => {
    if (agencyKey === undefined) {
      throw new Error('No agencyKey specified');
    } else if (stopId === undefined) {
      throw new Error('No stopId specified');
    } else if (routeId === undefined) {
      throw new Error('No routeId specified');
    }
  })
  .then(() => {
    const todayFormatted = moment().format('YYYYMMDD');
    const query = {
      agency_key: agencyKey
    };

    // Build query
    query[moment().format('dddd').toLowerCase()] = 1;

    return Calendar
      .find(query)
      .where('start_date').lte(todayFormatted)
      .where('end_date').gte(todayFormatted);
  })
  .then(services => {
    if (!services || services.length === 0) {
      throw new Error('No Service for this date');
    }

    const serviceIds = services.map(service => service.service_id);
    const query = {
      agency_key: agencyKey,
      route_id: routeId
    };

    if (directionId !== undefined) {
      query.direction_id = directionId;
    } // else match all directionIds

    return Trip.find(query).where('service_id').in(serviceIds);
  })
  .then(trips => {
    if (!trips || trips.length === 0) {
      throw new Error('No trips for this date');
    }

    const query = {
      agency_key: agencyKey,
      stop_id: stopId
    };

    // Limit query to 1000 stopTimes at a time
    const stopTimesLimit = 1000;

    return StopTime
      .find(query)
      .where('trip_id').in(trips.map(trip => trip.trip_id))
      .sort('departure_time')
      .limit(stopTimesLimit);
  })
  .then(stopTimes => {
    if (!stopTimes || stopTimes.length === 0) {
      throw new Error('No times available for this stop on this date');
    }

    const times = stopTimes.map(stopTime => stopTime.departure_time);

    if (cb) {
      cb(null, times);
    }

    return times;
  })
  .catch(cb);
};
