const path = require('path');

const should = require('should');

const config = require('../config.json');
const gtfs = require('../../');

const database = require('../support/database');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

describe('gtfs.getStopsAsGeoJSON(): ', () => {
  before(async () => {
    await database.connect(config);
  });

  after(async () => {
    await database.teardown();
    await database.close();
  });

  beforeEach(async () => {
    await database.teardown();
    await gtfs.import(config);
  });

  it('should return geojson with an empty features array if no stops exist for given agency', async () => {
    await database.teardown();

    const agencyKey = 'non_existing_agency';
    const geojson = await gtfs.getStopsAsGeoJSON({
      agency_key: agencyKey
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.should.have.length(0);
  });

  it('should return geojson with stops if they exist for given agency', async () => {
    const agencyKey = 'caltrain';

    const geojson = await gtfs.getStopsAsGeoJSON({
      agency_key: agencyKey
    })

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.should.have.length(95);
  });

  it('should return geojson with stops if they exist for given agency and stopIds', async () => {
    const agencyKey = 'caltrain';
    const stopIds = [
      '70031',
      '70061'
    ];

    const geojson = await gtfs.getStopsAsGeoJSON({
      agency_key: agencyKey,
      stop_id: {$in: stopIds}
    });

    should.exist(geojson);
    geojson.type.should.equal('FeatureCollection');
    geojson.features.should.have.length(2);
  });
});
