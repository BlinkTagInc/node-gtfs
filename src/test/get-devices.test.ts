import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getDevices } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getDevices():', () => {
  it('should return empty array if no devices (TIDES)', () => {
    const deviceId = 'fake-device-id';

    const results = getDevices({
      device_id: deviceId,
    });

    expect(results).toHaveLength(0);
  });
});
