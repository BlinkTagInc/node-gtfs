/* eslint-env mocha */

import fs from 'fs';

import config from '../test-config.js';
import { deleteDb, openDb, importGtfs } from '../../index.js';

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
  before(async () => {});

  after(() => {
    // Delete extra databases
    fs.rmSync(db2Config.sqlitePath, { force: true });
    fs.rmSync(db3Config.sqlitePath, { force: true });
  });

  it('should allow deleting a database', async () => {
    const db2 = openDb(db2Config);
    await importGtfs(db2Config);

    const db3 = openDb(db3Config);
    await importGtfs(db3Config);

    db2.name.should.equal('./tmpdb2');
    db3.name.should.equal('./tmpdb3');

    fs.existsSync(db2Config.sqlitePath).should.equal(true);
    fs.existsSync(db3Config.sqlitePath).should.equal(true);

    deleteDb(db2);

    fs.existsSync(db2Config.sqlitePath).should.equal(false);
    fs.existsSync(db3Config.sqlitePath).should.equal(true);

    deleteDb(db3);

    fs.existsSync(db2Config.sqlitePath).should.equal(false);
    fs.existsSync(db3Config.sqlitePath).should.equal(false);
  });
});
