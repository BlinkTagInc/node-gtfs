const Calendar = require('../../models/gtfs/calendar');
const Trip = require('../../models/gtfs/trip');

/*
 * Returns an array of calendars that match the query parameters.
 */
exports.getCalendars = async (query = {}, projection = '-_id', options = {lean: true}) => {
  if (query.route_id !== undefined) {
    const tripQuery = {route_id: query.route_id};

    if (query.agency_key !== undefined) {
      tripQuery.agency_key = query.agency_key;
    }
    const serviceIds = await Trip.find(tripQuery).distinct('service_id');
    query.service_id = {$in: serviceIds};
    delete query.route_id;
  }
  return Calendar.find(query, projection, options);
};
