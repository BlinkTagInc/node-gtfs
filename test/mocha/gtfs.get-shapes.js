/* eslint-env mocha */

const path = require('path');

const mongoose = require('mongoose');
const should = require('should');

const config = require('../config.json');
const gtfs = require('../..');

// Setup fixtures
const agenciesFixtures = [{
  agency_key: 'caltrain',
  path: path.join(__dirname, '../fixture/caltrain_20160406.zip')
}];

config.agencies = agenciesFixtures;

const agencyKey = agenciesFixtures[0].agency_key;

describe('gtfs.getShapes():', () => {
  before(async () => {
    await mongoose.connect(config.mongoUrl, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
    await mongoose.connection.db.dropDatabase();
    await gtfs.import(config);
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  it('should return an empty array if no shapes exist for given agency', async () => {
    await mongoose.connection.db.dropDatabase();

    const agencyKey = 'non_existing_agency';
    const shapes = await gtfs.getShapes({
      agency_key: agencyKey
    });

    should.exist(shapes);
    shapes.should.have.length(0);

    await gtfs.import(config);
  });

  it('should return array of shapes for given agency', async () => {
    const shapes = await gtfs.getShapes({
      agency_key: agencyKey
    });

    should.exist(shapes);
    shapes.should.have.length(8);

    for (const shape of shapes) {
      shape.should.not.have.any.keys('_id');
    }
  });

  it('should return array of shapes for given agency by route', async () => {
    const routeId = 'TaSj-16APR';
    const shapes = await gtfs.getShapes({
      agency_key: agencyKey,
      route_id: routeId
    });

    should.exist(shapes);
    shapes.should.have.length(2);

    for (const shape of shapes) {
      shape.should.not.have.any.keys('_id');
    }
  });

  it('should return array of shapes for given agency by route and direction', async () => {
    const routeId = 'TaSj-16APR';
    const directionId = 0;
    const shapes = await gtfs.getShapes({
      agency_key: agencyKey,
      route_id: routeId,
      direction_id: directionId
    });

    should.exist(shapes);
    shapes.should.have.length(1);

    const shape = shapes[0];
    shape.should.have.length(114);
    shape[0].shape_id.should.equal('cal_tam_sj');
    shape.should.not.have.any.keys('_id');
  });

  it('should return array of shapes for given agency and service_id', async () => {
    const serviceId = 'CT-16APR-Caltrain-Saturday-02';
    const shapes = await gtfs.getShapes({
      agency_key: agencyKey,
      service_id: serviceId
    });

    should.exist(shapes);
    shapes.should.have.length(3);

    for (const shape of shapes) {
      shape.should.not.have.any.keys('_id');
    }
  });

  it('should return array of shapes for given agency and shape_ids', async () => {
    const shapeIds = [
      'cal_sj_sf',
      'cal_gil_sf'
    ];
    const shapes = await gtfs.getShapes({
      agency_key: agencyKey,
      shape_id: { $in: shapeIds }
    });

    should.exist(shapes);
    shapes.should.have.length(2);

    for (const shape of shapes) {
      shape.should.not.have.any.keys('_id');
    }
  });
});
