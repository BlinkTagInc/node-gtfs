if (process.env.NODE_ENV === 'test'){
  module.exports = require('./test/config');
  return;
}

module.exports = {
  mongo_url: process.env.MONGO_URL || 'mongodb://localhost:27017/gtfs',
  agencies: [
    /*
     * You can specify agencies in the following ways:
     * * Specify a download URL (you can get one from transitfeeds.com):
     * {agency_key: 'bart', url: 'http://api.transitfeeds.com/v1/getLatestFeedVersion?feed=bart%2F58&key=YOUR TRANSITFEEDS.COM API KEY'}
     *
     * * Specify a path to a zipped GTFS file:
     * {agency_key: 'localAgency', path: '/path/to/the/gtfs.zip'}
     *
     * * Specify a path to an unzipped GTFS file:
     * {agency_key: 'localAgency', path: '/path/to/the/unzipped/gtfs/'}
     *
     * Additionally, you can also specify a proj4 projection string to correct the bad formed coordinates:
     * {agency_key: 'lambertIIProjection', path: '/path/to/gtfs.zip', proj: '+proj=lcc +lat_1=46.8 +lat_0=46.8 +lon_0=0 +k_0=0.99987742 +x_0=600000 +y_0=2200000 +a=6378249.2 +b=6356515 +towgs84=-168,-60,320,0,0,0,0 +pm=paris +units=m +no_defs'}
     */

    {
      agency_key: 'county-connection',
      url: 'http://cccta.org/GTFS/google_transit.zip'
    }
  ]
};
