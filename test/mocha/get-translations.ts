/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, getTranslations } from '../../index.js';

describe('getTranslations():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no translations', () => {
    const fieldName = 'fake-field-name';

    const results = getTranslations({
      field_name: fieldName,
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
