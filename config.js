module.exports = {
  mongo_url: process.env.MONGOHQ_URL || 'mongodb://localhost:27017/gtfs'
  , agencies: [
    /* Put agency_key names from gtfs-data-exchange.com.
     Optionally, specify a download URL to use a dataset not from gtfs-data-exchange.com */
    'alamedaoakland-ferry'
    , { agency_key: 'caltrain', url: 'http://www.gtfs-data-exchange.com/agency/caltrain/latest.zip'}
    , 'ac-transit'
    , 'county-connection'
    , 'san-francisco-municipal-transportation-agency'
    , 'bay-area-rapid-transit'
    , 'golden-gate-ferry'
  ]
}
