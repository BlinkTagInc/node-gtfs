/* eslint-env mocha */

import should from 'should';

import { openDb, closeDb } from '../../lib/db.js';
import config from '../test-config.js';
import { importGtfs, getTranslations } from '../../index.js';

describe('getTranslations():', () => {
  before(async () => {
    await openDb(config);
    await importGtfs(config);
  });

  after(async () => {
    await closeDb();
  });

  it('should return empty array if no translations', async () => {
    const fieldName = 'fake-field-name';

    const results = await getTranslations({
      field_name: fieldName
    });
    should.exists(results);
    results.should.have.length(0);
  });
});
