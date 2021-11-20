/* eslint-env mocha */
import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getAgencies,
} from '../../index.js';

describe('getAgencies():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no agencies exist', async () => {
    const agencyId = 'fake-agency-id';
    const results = await getAgencies({
      agency_id: agencyId,
    });
    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected agencies with no query', async () => {
    const results = await getAgencies();

    const expectedResult = {
      id: 1,
      agency_id: 'CT',
      agency_name: 'Caltrain',
      agency_url: 'http://www.caltrain.com',
      agency_timezone: 'America/Los_Angeles',
      agency_lang: 'en',
      agency_phone: '800-660-4287',
      agency_fare_url: null,
      agency_email: null,
    };

    should.exist(results);
    results.length.should.equal(1);
    expectedResult.should.match(results[0]);
  });

  it('should return expected agency for agency_id and agency_lang', async () => {
    const agencyId = 'CT';
    const agencyLand = 'en';

    const results = await getAgencies({
      agency_id: agencyId,
      agency_lang: agencyLand,
    });

    const expectedResult = {
      id: 1,
      agency_id: 'CT',
      agency_name: 'Caltrain',
      agency_url: 'http://www.caltrain.com',
      agency_timezone: 'America/Los_Angeles',
      agency_lang: 'en',
      agency_phone: '800-660-4287',
      agency_fare_url: null,
      agency_email: null,
    };

    should.exist(results);
    results.length.should.equal(1);
    expectedResult.should.match(results[0]);
  });

  it('should return only specific keys for expected agency for agency_id', async () => {
    const agencyId = 'CT';

    const results = await getAgencies(
      {
        agency_id: agencyId,
      },
      ['agency_url', 'agency_lang']
    );

    const expectedResult = {
      agency_url: 'http://www.caltrain.com',
      agency_lang: 'en',
    };

    should.exist(results);
    results.length.should.equal(1);
    expectedResult.should.match(results[0]);
  });
});
