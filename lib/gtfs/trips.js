const utils = require("../utils");

const Trip = require("../../models/gtfs/trip");
const StopTime = require("../../models/gtfs/stop-time");

/*
 * Returns an array of trips that match the query parameters.
 */
exports.getTrips = (
  query = {},
  projection = utils.defaultProjection,
  options = { lean: true, timeout: true }
) => {
  return Trip.find(query, projection, options);
};

exports.getTripsByStopId = async (query = {}) => {
  return new Promise(async (resolve, reject) => {
    const stopTimes = StopTime.find({}, utils.defaultProjection, {
      timeout: true,
    })
      .where("stop_id")
      .in(query.stop.stop_id)
      .then((stopTimes) => {
        Trip.find({}, utils.defaultProjection, { timeout: true })
          .where("trip_id")
          .in(stopTimes.map((trip) => trip.trip_id))
          .then((trips) => {
            var stopInfo = JSON.parse(JSON.stringify(stopTimes));
            var tripInfo = JSON.parse(JSON.stringify(trips));
            for (var i = 0; i < stopInfo.length; i++) {
              var id = stopInfo[i].trip_id;
              for (var j = 0; j < tripInfo.length; j++) {
                if (tripInfo[j].trip_id == id) {
                  for (var key in tripInfo[j]) {
                    stopInfo[i][key] = tripInfo[j][key];
                  }
                  stopInfo[i]["stop_lat"] = query.stop.stop_lat;
                  stopInfo[i]["stop_lon"] = query.stop.stop_lon;
                  break;
                }
              }
            }
            resolve(stopInfo);
          })
          .catch((err) => reject(err));
      });
  });
};

/*
 * Returns an array of directions for an `agency_key` and `route_id` specified.
 */
exports.getDirectionsByRoute = async (query = {}) => {
  if (query.agency_key === "undefined") {
    throw new Error("`agency_key` is a required parameter.");
  }

  if (query.route_id === "undefined") {
    throw new Error("`route_id` is a required parameter.");
  }

  const directions = await Trip.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          trip_headsign: "$trip_headsign",
          direction_id: "$direction_id",
        },
      },
    },
  ]);

  return directions.map((direction) => ({
    route_id: query.route_id,
    trip_headsign: direction._id.trip_headsign,
    direction_id: direction._id.direction_id,
  }));
};
