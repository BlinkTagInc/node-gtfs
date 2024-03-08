/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getStoptimes } from '../../index.js';

describe('getStoptimes():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return an empty array if no stoptimes exist for given agency', () => {
    const stopId = 'fake-stop-id';

    const results = getStoptimes({
      stop_id: stopId,
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return array of stoptimes for given stop_id', () => {
    const stopId = '70011';

    const results = getStoptimes({
      stop_id: stopId,
    });
    should.exist(results);
    results.should.have.length(80);

    for (const result of results) {
      result.stop_id.should.equal(stopId);
    }
  });

  it('should return array of stoptimes for given trip_id ordered by stop_sequence', () => {
    const tripId = '421a';

    const results = getStoptimes(
      {
        trip_id: tripId,
      },
      [],
      [['stop_sequence', 'ASC']]
    );

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
