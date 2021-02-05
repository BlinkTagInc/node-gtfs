/* eslint-env mocha */

const should = require('should');

const { openDb, closeDb } = require('../../lib/db');
const config = require('../test-config.js');
const gtfs = require('../..');

describe('gtfs.getStoptimes():', () => {
  before(async () => {
    await openDb(config);
    await gtfs.import(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return an empty array if no stoptimes exist for given agency', async () => {
    const stopId = 'fake-stop-id';

    const results = await gtfs.getStoptimes({
      stop_id: stopId
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return array of stoptimes for given stop_id', async () => {
    const stopId = '70011';

    const results = await gtfs.getStoptimes({
      stop_id: stopId
    });
    should.exist(results);
    results.should.have.length(80);

    for (const result of results) {
      result.stop_id.should.equal(stopId);
    }
  });

  it('should return array of stoptimes for given trip_id ordered by stop_sequence', async () => {
    const tripId = '421a';

    const results = await gtfs.getStoptimes({
      trip_id: tripId
    }, [], [
      ['stop_sequence', 'ASC']
    ]);

    should.exist(results);
    results.should.have.length(24);

    let lastStopSequence;
    for (const result of results) {
      result.trip_id.should.equal(tripId);
      if (lastStopSequence !== undefined) {
        result.stop_sequence.should.be.greaterThan(lastStopSequence);
      }

      lastStopSequence = result.stop_sequence;
    }
  });
});
