/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getDb():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should allow raw db queries: calendar_dates', async () => {
    const serviceIds = ['CT-16APR-Caltrain-Weekday-01'];
    const db = gtfs.getDb();
    const results = await db.all(`SELECT * FROM calendar_dates WHERE exception_type = 1 AND service_id NOT IN (${serviceIds.map(serviceId => `'${serviceId}'`).join(', ')})`);

    should.exists(results);
    results.should.have.length(4);
  });

  it('should allow raw db queries: trips', async () => {
    // Find all trips between two stop ids
    const startStopId = '70261';
    const endStopId = '70131';
    const db = gtfs.getDb();
    const results = await db.all('SELECT * from trips where trips.trip_id IN (SELECT start_stop_times.trip_id FROM stop_times as start_stop_times WHERE stop_id = ? AND start_stop_times.stop_sequence < (SELECT end_stop_times.stop_sequence FROM stop_times as end_stop_times WHERE end_stop_times.stop_sequence > start_stop_times.stop_sequence AND end_stop_times.trip_id = start_stop_times.trip_id AND end_stop_times.stop_id = ? ))', [startStopId, endStopId]);
    should.exists(results);
    results.should.have.length(62);
  });
});
