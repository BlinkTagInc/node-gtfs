/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getTrips } from '../../index.js';

describe('getTrips():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no trips exist', () => {
    const tripId = 'fake-trip-id';

    const results = getTrips({
      trip_id: tripId,
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected trips', () => {
    const routeId = 'Bu-16APR';

    const results = getTrips({
      route_id: routeId,
    });

    const expectedResult = {
      trip_id: '329',
      route_id: 'Bu-16APR',
      service_id: 'CT-16APR-Caltrain-Weekday-01',
      trip_headsign: 'SAN FRANCISCO STATION',
      trip_short_name: '329',
      direction_id: 0,
      block_id: null,
      shape_id: 'cal_tam_sf',
      wheelchair_accessible: 1,
      bikes_allowed: 1,
    };

    should.exists(results);
    results.length.should.equal(30);
    results.should.containEql(expectedResult);
  });
});
