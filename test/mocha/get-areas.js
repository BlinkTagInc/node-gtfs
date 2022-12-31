/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getAreas } from '../../index.js';

describe('getAreas():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no areas exist', () => {
    const areaId = 'fake-area-id';
    const results = getAreas({
      area_id: areaId,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
