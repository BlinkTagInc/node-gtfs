import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import Database from 'better-sqlite3';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getAgencies } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getAgencies():', () => {
  it('should query an explicitly supplied database through the shared implementation', () => {
    const explicitDb = new Database(':memory:');

    try {
      explicitDb.exec(
        "CREATE TABLE agency (agency_id TEXT); INSERT INTO agency VALUES ('isolated-agency');",
      );

      const results = getAgencies({}, ['agency_id'], [], { db: explicitDb });

      expect(results).toEqual([{ agency_id: 'isolated-agency' }]);
    } finally {
      closeDb(explicitDb);
    }
  });

  it('should return empty array if no agencies exist', () => {
    const agencyId = 'fake-agency-id';
    const results = getAgencies({
      agency_id: agencyId,
    });

    expect(results).toHaveLength(0);
  });

  it('should return expected agencies with no query', () => {
    const results = getAgencies();

    const expectedResult = {
      agency_id: 'CT',
      agency_name: 'Caltrain',
      agency_url: 'http://www.caltrain.com',
      agency_timezone: 'America/Los_Angeles',
      agency_lang: 'en',
      agency_phone: '800-660-4287',
      agency_fare_url: null,
      agency_email: null,
      cemv_support: null,
    };

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expectedResult);
  });

  it('should return no records for an empty IN array', () => {
    expect(getAgencies({ agency_id: [] })).toEqual([]);
  });

  it('should bind nullish array values as SQL NULL', () => {
    expect(getAgencies({ agency_fare_url: [undefined] })).toHaveLength(1);
    expect(
      getAgencies({ agency_fare_url: [null, 'not-present'] }),
    ).toHaveLength(1);
  });

  it('should return expected agency for agency_id and agency_lang', () => {
    const agencyId = 'CT';
    const agencyLand = 'en';

    const results = getAgencies({
      agency_id: agencyId,
      agency_lang: agencyLand,
    });

    const expectedResult = {
      agency_id: 'CT',
      agency_name: 'Caltrain',
      agency_url: 'http://www.caltrain.com',
      agency_timezone: 'America/Los_Angeles',
      agency_lang: 'en',
      agency_phone: '800-660-4287',
      agency_fare_url: null,
      agency_email: null,
      cemv_support: null,
    };

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expectedResult);
  });

  it('should return only specific keys for expected agency for agency_id', () => {
    const agencyId = 'CT';

    const results = getAgencies(
      {
        agency_id: agencyId,
      },
      ['agency_url', 'agency_lang'],
    );

    const expectedResult = {
      agency_url: 'http://www.caltrain.com',
      agency_lang: 'en',
    };

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expectedResult);
  });
});
