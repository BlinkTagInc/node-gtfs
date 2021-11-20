/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import {
  openDb,
  getDb,
  closeDb,
  importGtfs,
  getTranslations,
} from '../../index.js';

describe('getTranslations():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    const db = getDb(config);
    await closeDb(db);
  });

  it('should return empty array if no translations', async () => {
    const fieldName = 'fake-field-name';

    const results = await getTranslations({
      field_name: fieldName,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
