const _ = require('lodash');
const utils = require('../utils');

const Stop = require('../../models/stop');
const StopTime = require('../../models/stop-time');
const Trip = require('../../models/trip');

function stopsToGeoJSON(stops) {
  return {
    type: 'FeatureCollection',
    features: stops.map(stop => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: stop.loc
      },
      properties: stop
    }))
  };
}

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
 * Returns geoJSON with stops for the `agencyKey` specified, optionally limited
 * to the `stopIds` specified
 */
exports.getStopsAsGeoJSON = (agencyKey, stopIds, cb) => {
  if (_.isFunction(stopIds)) {
    cb = stopIds;
    stopIds = undefined;
  }

  return exports.getStops(agencyKey, stopIds)
  .then(stopsToGeoJSON)
  .then(geojson => {
    if (cb) {
      cb(null, geojson);
    }

    return geojson;
  })
  .catch(cb);
};

/*
 * Returns an array of stops for the `agencyKey` specified, optionally
 * limited to the `stopCodes` specified
 */
exports.getStopsByStopCode = (agencyKey, stopCodes, cb) => {
  if (_.isFunction(stopCodes)) {
    cb = stopCodes;
    stopCodes = undefined;
  }

  const query = {
    agency_key: agencyKey
  }

  if (stopCodes !== undefined) {
    if (!_.isArray(stopCodes)) {
      stopCodes = [stopCodes];
    }

    query.stop_code = {
      $in: stopCodes
    };
  }

  return Stop.find(query).exec(cb);
};

/*
 * Returns geoJSON with stops for the `agency_key` specified, optionally
 * limited to the `stop_code` specified
 */
exports.getStopsByStopCodeAsGeoJSON = (agencyKey, stopCodes, cb) => {
  if (_.isFunction(stopCodes)) {
    cb = stopCodes;
    stopCodes = undefined;
  }

  return exports.getStopsByStopCode(agencyKey, stopCodes)
  .then(stopsToGeoJSON)
  .then(geojson => {
    if (cb) {
      cb(null, geojson);
    }

    return geojson;
  })
  .catch(cb);
};

/*
 * Returns an array of stops along the `routeId` for the `agencyKey` and
 * `directionId` specified
 */
exports.getStopsByRoute = (agencyKey, routeId, directionId, cb) => {
  if (_.isFunction(directionId)) {
    cb = directionId;
    directionId = undefined;
  }

  const longestTrip = {};
  const tripIds = {};

  const query = {
    agency_key: agencyKey,
    route_id: routeId
  };
  if (directionId !== undefined) {
    query.direction_id = directionId;
  } // else match all directionIds

  return Trip.find(query).exec()
  .then((trips) => {
    trips.forEach((trip) => {
      if (!tripIds[trip.direction_id]) {
        tripIds[trip.direction_id] = [];
      }
      tripIds[trip.direction_id].push(trip.trip_id);
    });
  })
  .then(() => {
    const directionIds = _.keys(tripIds);
    return Promise.all(directionIds.map(directionId => {
      if (!tripIds[directionId]) {
        return;
      }

      return Promise.all(tripIds[directionId].map(tripId => {
        return StopTime.find({
          agency_key: agencyKey,
          trip_id: tripId
        },
        null, {
          sort: 'stop_sequence'
        })
        .exec()
        .then(stopTimes => {
          if (!stopTimes || !stopTimes.length) {
            return;
          }

          // Compare to longest trip for given directionId to see if trip length is longest for given direction
          if (!longestTrip[directionId]) {
            longestTrip[directionId] = [];
          }
          if (stopTimes.length > longestTrip[directionId].length) {
            longestTrip[directionId] = stopTimes;
          }
        });
      }));
    }));
  })
  .then(() => {
    const directionIds = _.keys(tripIds);
    return Promise.all(directionIds.map(directionId => {
      if (!longestTrip[directionId]) {
        return;
      }

      return Promise.all(longestTrip[directionId].map(stopTime => {
        return Stop.findOne({
          agency_key: agencyKey,
          stop_id: stopTime.stop_id
        })
        .exec()
        .then(stop => stop.toObject());
      }));
    }))
    .then(stops => {
      return _.reduce(directionIds, (memo, directionId, idx) => {
        memo[directionId] = stops[idx];
        return memo;
      }, {});
    });
  })
  .then((stops) => {
    if (directionId === undefined) {
      // If no directionId specified in the request, return an array of directionIds with stops for each
      return _.map(stops, (stops, directionId) => ({
        direction_id: directionId,
        stops: stops || []
      }));
    }

    return stops[directionId] || [];
  })
  .then(results => {
    if (cb) {
      cb(null, results);
    }

    return results;
  })
  .catch(cb);
};

/*
 * Returns geoJSON with stops along the `routeId` for the `agencyKey` and
 * `directionId` specified
 */
exports.getStopsByRouteAsGeoJSON = (agencyKey, routeId, directionId, cb) => {
  if (_.isFunction(directionId)) {
    cb = directionId;
    directionId = undefined;
  }

  return exports.getStopsByRoute(agencyKey, routeId, directionId)
  .then(stopsToGeoJSON)
  .then(geojson => {
    if (cb) {
      cb(null, geojson);
    }

    return geojson;
  })
  .catch(cb);
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

/*
 * Returns geoJSON with stops within a `radius` of the `lat`, `lon` specified
 */
exports.getStopsByDistanceAsGeoJSON = (lat, lon, radius, cb) => {
  if (_.isFunction(radius)) {
    cb = radius;
    radius = 1; // default is 1 mile
  }

  return exports.getStopsByDistance(lat, lon, radius)
  .then(stopsToGeoJSON)
  .then(geojson => {
    if (cb) {
      cb(null, geojson);
    }

    return geojson;
  })
  .catch(cb);
};
