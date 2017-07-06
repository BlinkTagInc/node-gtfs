const _ = require('lodash');
const utils = require('../utils');
const geojsonUtils = require('../geojson-utils');

const Agency = require('../../models/agency');
const Route = require('../../models/route');
const Stop = require('../../models/stop');
const StopTime = require('../../models/stop-time');
const Trip = require('../../models/trip');

function stopsToGeoJSON(stops) {
  const agencies = {};

  // Get all agencies for reference
  return Agency.find({}).lean()
  .then(results => {
    results.forEach(agency => {
      agencies[agency.agency_key] = agency;
    });
  })
  .then(() => {
    if (!stops.length || !_.has(_.first(stops), 'stops')) {
      return stops;
    }

    const features = [];
    stops.forEach(stopList => {
      stopList.stops.forEach(stop => {
        stop.direction_id = parseInt(stopList.direction_id, 10);
        features.push(stop);
      });
    });
    return features;
  })
  .then(stops => Promise.all(stops.map(item => {
    const stop = item.toObject();
    const agency = agencies[stop.agency_key];
    stop.agency_name = agency.agency_name;

    return StopTime
    .find({
      agency_key: stop.agency_key,
      stop_id: stop.stop_id
    })
    .distinct('trip_id')
    .then(tripIds => {
      return Trip
      .find({agency_key: stop.agency_key})
      .distinct('route_id')
      .where('trip_id').in(tripIds);
    })
    .then(routeIds => {
      return Route
      .find({agency_key: stop.agency_key})
      .where('route_id').in(routeIds)
      .select({_id: 0, agency_key: 0, agency_id: 0, route_type: 0})
      .lean();
    })
    .then(routes => {
      stop.routes = routes;
      return stop;
    });
  })))
  .then(stops => geojsonUtils.featuresToGeoJSON(geojsonUtils.stopsToGeoJSONFeatures(stops)));
}

/*
 * Returns an array of stops for the `agencyKey` specified, optionally
 * limited to the `stopIds` specified
 */
exports.getStops = (agencyKey, stopIds) => {
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

  return Stop.find(query);
};

/*
 * Returns geoJSON with stops for the `agencyKey` specified, optionally limited
 * to the `stopIds` specified
 */
exports.getStopsAsGeoJSON = (agencyKey, stopIds) => {
  return exports.getStops(agencyKey, stopIds)
  .then(stopsToGeoJSON);
};

/*
 * Returns an array of stops for the `agencyKey` specified, optionally
 * limited to the `stopCodes` specified
 */
exports.getStopsByStopCode = (agencyKey, stopCodes) => {
  const query = {
    agency_key: agencyKey
  };

  if (stopCodes !== undefined) {
    if (!_.isArray(stopCodes)) {
      stopCodes = [stopCodes];
    }

    query.stop_code = {
      $in: stopCodes
    };
  }

  return Stop.find(query);
};

/*
 * Returns geoJSON with stops for the `agency_key` specified, optionally
 * limited to the `stop_code` specified
 */
exports.getStopsByStopCodeAsGeoJSON = (agencyKey, stopCodes) => {
  return exports.getStopsByStopCode(agencyKey, stopCodes)
  .then(stopsToGeoJSON);
};

/*
 * Returns an array of stops along the `routeId` for the `agencyKey` and
 * `directionId` specified
 */
exports.getStopsByRoute = (agencyKey, routeId, directionId) => {
  const longestTrip = {};
  const tripIds = {};

  const query = {
    agency_key: agencyKey,
    route_id: routeId
  };

  if (directionId !== undefined) {
    query.direction_id = directionId;
  } // Else match all directionIds

  return Trip.find(query)
  .then(trips => {
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
        .then(stopTimes => {
          if (!stopTimes || stopTimes.length === 0) {
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
        });
      }));
    }))
    .then(stops => {
      return _.reduce(directionIds, (memo, directionId, idx) => {
        memo[directionId] = stops[idx];
        return memo;
      }, {});
    });
  })
  .then(stops => {
    if (directionId === undefined) {
      // If no directionId specified in the request, return an array of directionIds with stops for each
      return _.map(stops, (stops, directionId) => ({
        direction_id: directionId,
        stops: stops || []
      }));
    }

    return stops[directionId] || [];
  });
};

/*
 * Returns geoJSON with stops along the `routeId` for the `agencyKey` and
 * `directionId` specified
 */
exports.getStopsByRouteAsGeoJSON = (agencyKey, routeId, directionId) => {
  return exports.getStopsByRoute(agencyKey, routeId, directionId)
  .then(stopsToGeoJSON);
};

/*
 * Returns an array of stops within a `radius` of the `lat`, `lon` specified.
 * Default `radius` is 1 mile.
 */
exports.getStopsByDistance = (lat, lon, radius = 1) => {
  lat = parseFloat(lat);
  lon = parseFloat(lon);

  return Stop
  .where('loc')
  .near(lon, lat).maxDistance(utils.milesToDegrees(radius));
};

/*
 * Returns geoJSON with stops within a `radius` of the `lat`, `lon` specified.
 * Default `radius` is 1 mile.
 */
exports.getStopsByDistanceAsGeoJSON = (lat, lon, radius = 1) => {
  return exports.getStopsByDistance(lat, lon, radius)
  .then(stopsToGeoJSON);
};
