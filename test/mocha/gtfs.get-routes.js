/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getRoutes():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no routes for given agency exist', async () => {
    const routeId = 'fake-route-id';

    const results = await gtfs.getRoutes({
      route_id: routeId
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected routes', async () => {
    const results = await gtfs.getRoutes(
      {},
      [],
      [['route_long_name', 'ASC']]
    );

    const expectedResults = [
      {
        route_id: 'Bu-16APR',
        agency_id: null,
        route_short_name: null,
        route_long_name: 'Baby Bullet',
        route_desc: null,
        route_type: 2,
        route_url: null,
        route_color: 'E31837',
        route_text_color: null,
        route_sort_order: null,
        continuous_pickup: null,
        continuous_drop_off: null
      },
      {
        route_id: 'Li-16APR',
        agency_id: null,
        route_short_name: null,
        route_long_name: 'Limited',
        route_desc: null,
        route_type: 2,
        route_url: null,
        route_color: 'FEF0B5',
        route_text_color: null,
        route_sort_order: null,
        continuous_pickup: null,
        continuous_drop_off: null
      },
      {
        route_id: 'Lo-16APR',
        agency_id: null,
        route_short_name: null,
        route_long_name: 'Local',
        route_desc: null,
        route_type: 2,
        route_url: null,
        route_color: 'FFFFFF',
        route_text_color: null,
        route_sort_order: null,
        continuous_pickup: null,
        continuous_drop_off: null
      },
      {
        route_id: 'TaSj-16APR',
        agency_id: null,
        route_short_name: null,
        route_long_name: 'Tamien / San Jose Diridon Caltrain Shuttle',
        route_desc: null,
        route_type: 3,
        route_url: null,
        route_color: '41AD49',
        route_text_color: null,
        route_sort_order: null,
        continuous_pickup: null,
        continuous_drop_off: null
      }
    ];

    should.exist(results);
    results.should.have.length(4);
    expectedResults.should.match(results);
  });

  it('should return expected routes for a specific stop_id', async () => {
    const results = await gtfs.getRoutes(
      { stop_id: '70321' },
      [],
      [['route_long_name', 'ASC']]
    );

    const expectedResults = [
      {
        route_id: 'Li-16APR',
        agency_id: null,
        route_short_name: null,
        route_long_name: 'Limited',
        route_desc: null,
        route_type: 2,
        route_url: null,
        route_color: 'FEF0B5',
        route_text_color: null,
        route_sort_order: null,
        continuous_pickup: null,
        continuous_drop_off: null
      }
    ];

    should.exist(results);
    results.should.have.length(1);
    expectedResults.should.match(results);
  });

  it('should return no routes for a invalid stop_id', async () => {
    const results = await gtfs.getRoutes(
      { stop_id: 'not-valid' },
      [],
      [['route_long_name', 'ASC']]
    );

    const expectedResults = [];

    should.exist(results);
    results.should.have.length(0);
    expectedResults.should.match(results);
  });
});
