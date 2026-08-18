import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getServiceAlertInformedEntities,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getServiceAlertInformedEntities():', () => {
  it('should return empty array if no informed entities (GTFS-Realtime)', () => {
    const alertId = 'fake-alert-id';

    const results = getServiceAlertInformedEntities({
      alert_id: alertId,
    });

    expect(results).toHaveLength(0);
  });
});
