const _ = require('lodash');
const async = require('async');
const utils = require('../utils');

const Stop = require('../../models/Stop');
const StopTime = require('../../models/StopTime');
const Trip = require('../../models/Trip');

/*
 * Returns an array of stops for the `agency_key` specified, optionally
 * limited to the `stop_ids` specified
 */
exports.getStops = (agency_key, stop_ids, cb) => {
  if (_.isFunction(stop_ids)) {
    cb = stop_ids;
    stop_ids = undefined;
  }

  const query = {
    agency_key
  };

  if (stop_ids !== undefined) {
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
 * Returns an array of stops for the `agency_key` specified, optionally
 * limited to the `stop_code` specified
 */
exports.getStopsByStopCode = (agency_key, stop_code, cb) => {
  if (_.isFunction(stop_code)) {
    cb = stop_code;
    stop_code = undefined;
  }

  const query = {
    agency_key
  }

  if (stop_code !== undefined) {
    if (!_.isArray(stop_code)) {
      stop_code = [stop_code];
    }

    query.stop_code = {
      stop_code : stop_code
    };
  }

  return Stop.find(query).exec(cb);
};


/*
 * Returns an array of stops along the `route_id` for the `agency_key` and `direction_id` specified
 */
exports.getStopsByRoute = (agency_key, route_id, direction_id, cb) => {
  if (_.isFunction(direction_id)) {
    cb = direction_id;
    direction_id = undefined;
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

    // transform results based on whether direction_id was
    // - specified (return stops for a direction)
    // - or not specified (return stops for all directions)
    let results;
    if (direction_id !== undefined) {
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
    if (direction_id !== undefined) {
      query.direction_id = direction_id;
    } // else match all direction_ids

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
    const direction_ids = _.keys(trip_ids);
    async.forEach(direction_ids, (direction_id, cb) => {
      if (!trip_ids[direction_id]) {
        return cb();
      }

      async.forEach(trip_ids[direction_id], (trip_id, cb) => {
        StopTime.find({
          agency_key,
          trip_id
        },
        null, {
          sort: 'stop_sequence'
        },
        (err, stopTimes) => {
          if (err) return cb(err);

          if (!stopTimes || !stopTimes.length) {
            return cb();
          }

          // compare to longest trip for given direction_id to see if trip length is longest for given direction
          if (!longestTrip[direction_id]) {
            longestTrip[direction_id] = [];
          }
          if (stopTimes.length > longestTrip[direction_id].length) {
            longestTrip[direction_id] = stopTimes;
          }
          cb();
        });
      }, cb);
    }, cb);
  }

  function getStops(cb) {
    const direction_ids = _.keys(trip_ids);
    async.forEach(direction_ids, (direction_id, cb) => {
      if (!longestTrip[direction_id]) {
        return cb();
      }
      async.forEachSeries(longestTrip[direction_id], (stopTime, cb) => {
        Stop.findOne({
          agency_key,
          stop_id: stopTime.stop_id
        },
        (err, stop) => {
          if (err) return cb(err);

          if (!stops[direction_id]) {
            stops[direction_id] = [];
          }
          stops[direction_id].push(stop.toObject());
          cb();
        });
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
