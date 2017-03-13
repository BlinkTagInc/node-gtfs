const _ = require('lodash');
const async = require('async');
const utils = require('../utils');

const Stop = require('../../models/stop');
const StopTime = require('../../models/stop-time');
const Trip = require('../../models/trip');

/*
 * Returns an array of stops for the `agencyKey` specified, optionally
 * limited to the `stopIds` specified
 */
exports.getStops = (agencyKey, stopIds, cb) => {
  if (_.isFunction(stopIds)) {
    cb = stopIds;
    stopIds = undefined;
  }

  const query = {
    agency_key: agencyKey
  };

  if (stopIds !== undefined) {
    if (!_.isArray(stopIds)) {
      stopIds = [stopIds];
    }

    query.stop_id = {
      $in: stopIds
    };
  }

  return Stop.find(query).exec(cb);
};

/*
 * Returns an array of stops for the `agency_key` specified, optionally
 * limited to the `stop_code` specified
 */
exports.getStopsByStopCode = (agency_key, stop_codes, cb) => {
  if (_.isFunction(stop_codes)) {
    cb = stop_codes;
    stop_codes = undefined;
  }

  const query = {
    agency_key
  }

  if (stop_codes !== undefined) {
    if (!_.isArray(stop_codes)) {
      stop_codes = [stop_codes];
    }

    query.stop_code = {
      $in : stop_codes
    };
  }

  return Stop.find(query).exec(cb);
};


/*
 * Returns an array of stops along the `routeId` for the `agencyKey` and `directionId` specified
 */
exports.getStopsByRoute = (agencyKey, routeId, directionId, cb) => {
  if (_.isFunction(directionId)) {
    cb = directionId;
    directionId = undefined;
  }

  const longestTrip = {};
  const stops = {};
  const trip_ids = {};

  async.series([
    getTrips,
    getStopTimes,
    getStops
  ], (err) => {
    if (err) return cb(err);

    // transform results based on whether directionId was specified
    let results;
    if (directionId !== undefined) {
      results = stops[directionId] || [];
    } else {
      results = _.map(stops, (stops, directionId) => {
        return {
          direction_id: directionId,
          stops: stops || []
        };
      });
    }
    cb(null, results);
  });

  function getTrips(cb) {
    const query = {
      agency_key: agencyKey,
      route_id: routeId
    };
    if (directionId !== undefined) {
      query.direction_id = directionId;
    } // else match all directionIds

    Trip.find(query).exec()
    .then((trips) => {
      trips.forEach((trip) => {
        if (!trip_ids[trip.direction_id]) {
          trip_ids[trip.direction_id] = [];
        }
        trip_ids[trip.direction_id].push(trip.trip_id);
      });
      cb();
    }, cb);
  }

  function getStopTimes(cb) {
    const directionIds = _.keys(trip_ids);
    async.forEach(directionIds, (directionId, cb) => {
      if (!trip_ids[directionId]) {
        return cb();
      }

      async.forEach(trip_ids[directionId], (trip_id, cb) => {
        StopTime.find({
          agency_key: agencyKey,
          trip_id
        },
        null, {
          sort: 'stop_sequence'
        })
        .exec()
        .then(stopTimes => {
          if (!stopTimes || !stopTimes.length) {
            return cb();
          }

          // compare to longest trip for given directionId to see if trip length is longest for given direction
          if (!longestTrip[directionId]) {
            longestTrip[directionId] = [];
          }
          if (stopTimes.length > longestTrip[directionId].length) {
            longestTrip[directionId] = stopTimes;
          }
          cb();
        })
        .catch(cb);
      }, cb);
    }, cb);
  }

  function getStops(cb) {
    const directionIds = _.keys(trip_ids);
    async.forEach(directionIds, (directionId, cb) => {
      if (!longestTrip[directionId]) {
        return cb();
      }
      async.forEachSeries(longestTrip[directionId], (stopTime, cb) => {
        Stop.findOne({
          agency_key: agencyKey,
          stop_id: stopTime.stop_id
        })
        .exec()
        .then(stop => {
          if (!stops[directionId]) {
            stops[directionId] = [];
          }
          stops[directionId].push(stop.toObject());
          cb();
        })
        .catch(cb);
      }, cb);
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
exports.getStopsByDistance = (lat, lon, radius, cb) => {
  if (_.isFunction(radius)) {
    cb = radius;
    radius = 1; // default is 1 mile
  }

  lat = parseFloat(lat);
  lon = parseFloat(lon);

  return Stop
    .where('loc')
    .near(lon, lat).maxDistance(utils.milesToDegrees(radius))
    .exec(cb);
};
