import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import { rm } from 'fs/promises';
import { existsSync } from 'fs';

import config from './test-config.ts';
import { deleteDb, openDb, importGtfs } from '../../dist/index.js';

const db4Config = {
  agencies: [
    {
      ...config.agencies[0],
      exclude: ['shapes'],
    },
  ],
  verbose: false,
  sqlitePath: './tmpdb4',
};

const db5Config = {
  agencies: [
    {
      ...config.agencies[0],
      exclude: ['shapes'],
    },
  ],
  verbose: false,
  sqlitePath: './tmpdb5',
};

describe('deleteDb():', () => {
  beforeAll(async () => {
    openDb(db4Config);
    await importGtfs(db4Config);

    openDb(db5Config);
    await importGtfs(db5Config);
  });

  afterAll(async () => {
    await rm(db4Config.sqlitePath, { force: true, recursive: true });
    await rm(db5Config.sqlitePath, { force: true, recursive: true });
  });

  it('should allow deleting a database', async () => {
    const db4 = openDb(db4Config);
    const db5 = openDb(db5Config);

    expect(db4.name).toEqual('./tmpdb4');
    expect(existsSync(db4Config.sqlitePath)).toEqual(true);

    expect(db5.name).toEqual('./tmpdb5');
    expect(existsSync(db5Config.sqlitePath)).toEqual(true);

    deleteDb(db4);

    expect(existsSync(db4Config.sqlitePath)).toEqual(false);
    expect(existsSync(db5Config.sqlitePath)).toEqual(true);

    deleteDb(db5);

    expect(existsSync(db4Config.sqlitePath)).toEqual(false);
    expect(existsSync(db5Config.sqlitePath)).toEqual(false);
  });
});
