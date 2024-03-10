/* eslint-env mocha */

import should from 'should';
import fs from 'fs';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getShapes } from '../../index.js';

const db2Config = {
  agencies: [
    {
      ...config.agencies[0],
      exclude: ['shapes'],
    },
  ],
  verbose: false,
  sqlitePath: './tmpdb2',
};

const db3Config = {
  agencies: [
    {
      ...config.agencies[0],
      exclude: ['shapes'],
    },
  ],
  verbose: false,
  sqlitePath: './tmpdb3',
};

describe('openDb():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);

    // Close db2 and then delete it
    const db2 = openDb(db2Config);
    closeDb(db2);
    fs.unlinkSync(db2Config.sqlitePath);

    // Close db3 and then delete it
    const db3 = openDb(db3Config);
    closeDb(db3);
    fs.unlinkSync(db3Config.sqlitePath);
  });

  it('should allow raw db queries: calendar_dates', () => {
    const serviceIds = ['CT-16APR-Caltrain-Weekday-01'];
    const db = openDb();
    const results = db
      .prepare(
        `SELECT * FROM calendar_dates WHERE exception_type = 1 AND service_id NOT IN (${serviceIds
          .map((serviceId) => `'${serviceId}'`)
          .join(', ')})`,
      )
      .all();

    should.exists(results);
    results.should.have.length(4);
  });

  it('should allow raw db queries: trips', () => {
    // Find all trips between two stop ids
    const startStopId = '70261';
    const endStopId = '70131';
    const db = openDb();
    const results = db
      .prepare(
        'SELECT * from trips where trips.trip_id IN (SELECT start_stop_times.trip_id FROM stop_times as start_stop_times WHERE stop_id = ? AND start_stop_times.stop_sequence < (SELECT end_stop_times.stop_sequence FROM stop_times as end_stop_times WHERE end_stop_times.stop_sequence > start_stop_times.stop_sequence AND end_stop_times.trip_id = start_stop_times.trip_id AND end_stop_times.stop_id = ? ))',
      )
      .all(startStopId, endStopId);
    should.exists(results);
    results.should.have.length(62);
  });

  it('should allow multiple db connections', async () => {
    const db2 = openDb(db2Config);
    await importGtfs(db2Config);

    const db1 = openDb(config);

    db1.name.should.equal(':memory:');
    db2.name.should.equal('./tmpdb2');

    // Query db1 for shapes
    const shapeId = 'cal_sf_tam';
    const results1 = getShapes(
      {
        shape_id: shapeId,
      },
      [],
      [],
      { db: db1 },
    );

    const expectedResult = {
      shape_id: 'cal_sf_tam',
      shape_pt_lat: 37.45375587083584,
      shape_pt_lon: -122.18063950538635,
      shape_pt_sequence: 279,
      shape_dist_traveled: null,
    };

    should.exist(results1);
    results1.length.should.equal(401);
    results1.should.containEql(expectedResult);

    // Query db2 for shapes, none should exist
    const results2 = getShapes(
      {
        shape_id: shapeId,
      },
      [],
      [],
      { db: db2 },
    );

    should.exist(results2);
    results2.length.should.equal(0);
  });

  it('should allow `db` configuration option', async () => {
    const db3 = openDb(db3Config);

    await importGtfs({
      ...db3Config,
      db: db3,
    });

    // Query db3 for shapes, none should exist
    const shapeId = 'cal_sf_tam';
    const results = getShapes(
      {
        shape_id: shapeId,
      },
      [],
      [],
      { db: db3 },
    );

    should.exist(results);
    results.length.should.equal(0);
  });
});
