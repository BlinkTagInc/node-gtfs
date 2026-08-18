import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  openDb,
  closeDb,
  importGtfs,
  getVehicles,
  getTripsPerformed,
} from '../../dist/index.js';

let feedPath: string;

beforeAll(async () => {
  feedPath = await mkdtemp(path.join(tmpdir(), 'node-gtfs-tides-'));

  await writeFile(
    path.join(feedPath, 'agency.txt'),
    'agency_id,agency_name,agency_url,agency_timezone\n' +
      'agency-1,Test Agency,https://example.com,America/Los_Angeles\n',
  );

  await writeFile(
    path.join(feedPath, 'vehicles.csv'),
    'vehicle_id,model_name,capacity_seated\n' + 'bus-1,Test Bus,40\n',
  );

  await writeFile(
    path.join(feedPath, 'trips_performed.csv'),
    'service_date,trip_id_performed,vehicle_id,direction_id\n' +
      '20260817,trip-performed-1,bus-1,0\n',
  );

  openDb();
  await importGtfs({
    agencies: [{ path: feedPath }],
    logLevel: 'silent',
  });
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
  await rm(feedPath, { recursive: true, force: true });
});

describe('TIDES .csv import:', () => {
  it('should import a .csv table', () => {
    const results = getVehicles({ vehicle_id: 'bus-1' });

    expect(results).toHaveLength(1);
    expect(results[0].model_name).toBe('Test Bus');
    expect(results[0].capacity_seated).toBe(40);
  });

  it('should import typed columns from a .csv table', () => {
    const results = getTripsPerformed({
      trip_id_performed: 'trip-performed-1',
    });

    expect(results).toHaveLength(1);
    expect(results[0].service_date).toBe(20260817);
    expect(results[0].vehicle_id).toBe('bus-1');
    expect(results[0].direction_id).toBe(0);
  });
});
