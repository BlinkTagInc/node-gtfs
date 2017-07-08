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
    if (stops.length === 0 || !_.has(_.first(stops), 'stops')) {
      return stops;
    }

    const features = [];
    stops.forEach(stopList => {
      stopList.stops.forEach(stop => {
        stop.direction_id = stopList.direction_id;
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
  const results = [];
  const query = {
    agency_key: agencyKey,
    route_id: routeId
  };

  // If no directionId specified in request, match all directionIds
  if (directionId !== undefined) {
    query.direction_id = directionId;
  }

  return Trip.find(query).select({trip_id: 1, direction_id: 1})
  .then(trips => {
    return trips.reduce((memo, trip) => {
      if (!memo.get(trip.direction_id)) {
        memo.set(trip.direction_id, []);
      }

      memo.get(trip.direction_id).push(trip.trip_id);
      return memo;
    }, new Map());
  })
  .then(groupedTrips => Promise.all(Array.from(groupedTrips).map(group => {
    const directionId = group[0];
    return Promise.all(group[1].map(tripId => {
      return StopTime.find({
        agency_key: agencyKey,
        trip_id: tripId
      })
      .sort('stop_sequence')
      .select({stop_sequence: 1, stop_id: 1});
    }))
    .then(trips => _.sortBy(trips, stopTimes => stopTimes.length))
    .then(_.flatten)
    .then(stopTimes => {
      if (!stopTimes || stopTimes.length === 0) {
        return;
      }

      // Get a distinct list of stops
      const stopTimeList = stopTimes.reduce((memo, stopTime) => {
        memo[stopTime.stop_id] = stopTime;
        return memo;
      }, {});

      // Order stops by stop_sequence
      return _.sortBy(stopTimeList, stopTime => stopTime.stop_sequence).map(stopTime => stopTime.stop_id);
    })
    .then(stopIds => exports.getStops(agencyKey, stopIds))
    .then(stops => {
      results.push({
        direction_id: directionId,
        stops
      });
    });
  })))
  .then(() => {
    if (directionId === undefined) {
      // If no directionId specified in the request, return an array of directionIds with stops for each
      return results;
    }

    // Else return only stops for the direction requested
    const result = _.find(results, {direction_id: directionId});
    return result ? result.stops : [];
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
