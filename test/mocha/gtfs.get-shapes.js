/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getShapes():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return an empty array if no shapes exist', async () => {
    const shapeId = 'fake-shape-id';

    const results = await gtfs.getShapes({
      shape_id: shapeId
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return an empty array if no matching trips exist', async () => {
    const routeId = 'TaSj-16APR';
    const serviceId = 'fake-service-id';

    const results = await gtfs.getShapes({
      route_id: routeId,
      service_id: serviceId
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return array of shapes', async () => {
    const results = await gtfs.getShapes(
      {},
      [
        'shape_id',
        'shape_pt_lat',
        'shape_pt_lon',
        'shape_pt_sequence',
        'shape_dist_traveled'
      ]
    );

    const expectedResult = {
      shape_id: 'cal_tam_sf',
      shape_pt_lat: 37.60768711349564,
      shape_pt_lon: -122.39467978477478,
      shape_pt_sequence: 244,
      shape_dist_traveled: null
    };

    should.exist(results);
    results.length.should.equal(3008);
    results.should.containEql(expectedResult);
  });

  it('should return array of shapes by route', async () => {
    const routeId = 'TaSj-16APR';
    const results = await gtfs.getShapes(
      {
        route_id: routeId
      },
      [
        'shape_id',
        'shape_pt_lat',
        'shape_pt_lon',
        'shape_pt_sequence',
        'shape_dist_traveled'
      ]
    );

    const expectedResult = {
      shape_id: 'cal_tam_sj',
      shape_pt_lat: 37.323558,
      shape_pt_lon: -121.8919,
      shape_pt_sequence: 10051,
      shape_dist_traveled: null
    };

    should.exist(results);
    results.length.should.equal(331);
    results.should.containEql(expectedResult);
  });

  it('should return array of shapes for multiple routes', async () => {
    const results = await gtfs.getShapes(
      {
        route_id: [
          'Lo-16APR',
          'Li-16APR'
        ]
      },
      [
        'shape_id',
        'shape_pt_lat',
        'shape_pt_lon',
        'shape_pt_sequence',
        'shape_dist_traveled'
      ]
    );

    const expectedResult = {
      shape_id: 'cal_sj_sf',
      shape_pt_lat: 37.694407548683614,
      shape_pt_lon: -122.40173935890198,
      shape_pt_sequence: 306,
      shape_dist_traveled: null
    };

    should.exist(results);
    results.length.should.equal(2677);
    results.should.containEql(expectedResult);
  });

  it('should return empty array of for invalid route', async () => {
    const results = await gtfs.getShapes(
      {
        route_id: 'not-valid'
      }
    );

    should.exist(results);
    results.length.should.equal(0);
  });

  it('should return array of shapes by route and direction', async () => {
    const routeId = 'TaSj-16APR';
    const directionId = 0;
    const results = await gtfs.getShapes(
      {
        route_id: routeId,
        direction_id: directionId
      },
      [
        'shape_id',
        'shape_pt_lat',
        'shape_pt_lon',
        'shape_pt_sequence',
        'shape_dist_traveled'
      ]
    );

    const expectedResult = {
      shape_id: 'cal_tam_sj',
      shape_pt_lat: 37.323558,
      shape_pt_lon: -121.8919,
      shape_pt_sequence: 10051,
      shape_dist_traveled: null
    };

    should.exist(results);
    results.length.should.equal(114);
    results.should.containEql(expectedResult);
  });

  it('should return array of shapes for specific trip_id', async () => {
    const tripId = '329';
    const results = await gtfs.getShapes(
      {
        trip_id: tripId
      },
      [
        'shape_id',
        'shape_pt_lat',
        'shape_pt_lon',
        'shape_pt_sequence',
        'shape_dist_traveled'
      ]
    );

    const expectedResult = {
      shape_id: 'cal_tam_sf',
      shape_pt_lat: 37.337664044379544,
      shape_pt_lon: -121.90810561180115,
      shape_pt_sequence: 25,
      shape_dist_traveled: null
    };

    should.exist(results);
    results.length.should.equal(401);
    results.should.containEql(expectedResult);
  });

  it('should return array of shapes for specific service_id', async () => {
    const serviceId = 'CT-16APR-Caltrain-Sunday-02';
    const results = await gtfs.getShapes(
      {
        service_id: serviceId
      },
      [
        'shape_id',
        'shape_pt_lat',
        'shape_pt_lon',
        'shape_pt_sequence',
        'shape_dist_traveled'
      ]
    );

    const expectedResult = {
      shape_id: 'cal_sj_tam',
      shape_pt_lat: 37.294079,
      shape_pt_lon: -121.874108,
      shape_pt_sequence: 10154,
      shape_dist_traveled: null
    };

    should.exist(results);
    results.length.should.equal(713);
    results.should.containEql(expectedResult);
  });
});
