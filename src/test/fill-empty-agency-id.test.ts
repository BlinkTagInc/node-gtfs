import { describe, it, beforeEach, afterEach, expect } from './test-utils.ts';
import { writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { temporaryDirectory } from 'tempy';

import {
  openDb,
  closeDb,
  importGtfs,
  getAgencies,
  getRoutes,
  getFareAttributes,
  getAttributions,
} from '../../dist/index.js';

/**
 * Creates a minimal GTFS fixture directory with the given file contents.
 */
const createGtfsFixture = async (
  files: Record<string, string>,
): Promise<string> => {
  const dir = temporaryDirectory();
  for (const [filename, content] of Object.entries(files)) {
    await writeFile(path.join(dir, filename), content);
  }
  return dir;
};

describe('fillEmptyAgencyId:', function () {
  let fixturePath: string;

  beforeEach(() => {
    openDb();
  });

  afterEach(async () => {
    const db = openDb();
    closeDb(db);
    if (fixturePath) {
      await rm(fixturePath, { recursive: true, force: true });
      fixturePath = '';
    }
  });

  it('should backfill agency_id on routes and fare_attributes for a single-agency feed', async () => {
    fixturePath = await createGtfsFixture({
      'agency.txt':
        'agency_id,agency_name,agency_url,agency_timezone\n' +
        'ACT1,Test Agency,http://example.com,America/New_York',
      'routes.txt': 'route_id,agency_id,route_type\nR1,,3\nR2,,3',
      'fare_attributes.txt':
        'fare_id,agency_id,price,currency_type,payment_method,transfers\n' +
        'F1,,2.50,USD,0,0',
      // attribution with no route_id and no trip_id — should be backfilled
      'attributions.txt': 'attribution_id,organization_name\nATTR1,Test Org',
    });

    await importGtfs({
      agencies: [{ path: fixturePath, fillEmptyAgencyId: true }],
      verbose: false,
    });

    const routes = getRoutes();
    expect(routes).toHaveLength(2);
    for (const route of routes) {
      expect(route.agency_id).toBe('ACT1');
    }

    const fareAttributes = getFareAttributes();
    expect(fareAttributes).toHaveLength(1);
    expect(fareAttributes[0].agency_id).toBe('ACT1');

    // attributions with blank route_id and trip_id should be backfilled
    const attributions = getAttributions();
    expect(attributions).toHaveLength(1);
    expect(attributions[0].agency_id).toBe('ACT1');
  });

  it('should apply prefix to backfilled agency_id without double-prefixing', async () => {
    fixturePath = await createGtfsFixture({
      'agency.txt':
        'agency_id,agency_name,agency_url,agency_timezone\n' +
        'ACT1,Test Agency,http://example.com,America/New_York',
      'routes.txt': 'route_id,agency_id,route_type\nR1,,3',
    });

    await importGtfs({
      agencies: [{ path: fixturePath, fillEmptyAgencyId: true, prefix: 'X_' }],
      verbose: false,
    });

    const routes = getRoutes();
    expect(routes).toHaveLength(1);
    // route_id is prefixed; agency_id should be prefixed exactly once
    expect(routes[0].route_id).toBe('X_R1');
    expect(routes[0].agency_id).toBe('X_ACT1');
  });

  it('should not backfill agency_id when feed has more than one agency', async () => {
    fixturePath = await createGtfsFixture({
      'agency.txt':
        'agency_id,agency_name,agency_url,agency_timezone\n' +
        'ACT1,Agency One,http://example.com,America/New_York\n' +
        'ACT2,Agency Two,http://example.com,America/New_York',
      'routes.txt': 'route_id,agency_id,route_type\nR1,,3',
    });

    await importGtfs({
      agencies: [{ path: fixturePath, fillEmptyAgencyId: true }],
      verbose: false,
    });

    const routes = getRoutes();
    expect(routes).toHaveLength(1);
    // agency_id must remain null — a warning is emitted but agency_id is not filled
    expect(routes[0].agency_id).toBeNull();
  });

  it('should NOT backfill agency_id on attributions that have a route_id or trip_id', async () => {
    fixturePath = await createGtfsFixture({
      'agency.txt':
        'agency_id,agency_name,agency_url,agency_timezone\n' +
        'ACT1,Test Agency,http://example.com,America/New_York',
      'routes.txt': 'route_id,agency_id,route_type\nR1,,3',
      // attribution scoped to a route — agency_id should NOT be backfilled per GTFS spec
      'attributions.txt':
        'attribution_id,organization_name,route_id\nATTR1,Test Org,R1',
    });

    await importGtfs({
      agencies: [{ path: fixturePath, fillEmptyAgencyId: true }],
      verbose: false,
    });

    const attributions = getAttributions();
    expect(attributions).toHaveLength(1);
    // agency_id must remain null — route_id is set so the row is route-scoped, not agency-scoped
    expect(attributions[0].agency_id).toBeNull();
  });

  it('should warn and not backfill when the single agency has no agency_id', async () => {
    fixturePath = await createGtfsFixture({
      // agency_id column is absent — valid GTFS when there is only one agency
      'agency.txt':
        'agency_name,agency_url,agency_timezone\n' +
        'Test Agency,http://example.com,America/New_York',
      'routes.txt': 'route_id,agency_id,route_type\nR1,,3',
    });

    await importGtfs({
      agencies: [{ path: fixturePath, fillEmptyAgencyId: true }],
      verbose: false,
    });

    const routes = getRoutes();
    expect(routes).toHaveLength(1);
    // No agency_id to backfill from — agency_id should remain null
    expect(routes[0].agency_id).toBeNull();
  });

  it('should backfill agency_id from config `agencyId` when agency.txt has no agency_id column', async () => {
    fixturePath = await createGtfsFixture({
      // agency_id column is absent — valid GTFS when there is only one agency
      'agency.txt':
        'agency_name,agency_url,agency_timezone\n' +
        'Test Agency,http://example.com,America/New_York',
      'routes.txt': 'route_id,agency_id,route_type\nR1,,3',
      'fare_attributes.txt':
        'fare_id,agency_id,price,currency_type,payment_method,transfers\n' +
        'F1,,2.50,USD,0,0',
      'attributions.txt': 'attribution_id,organization_name\nATTR1,Test Org',
    });

    await importGtfs({
      agencies: [
        { path: fixturePath, fillEmptyAgencyId: true, agencyId: 'CFG1' },
      ],
      verbose: false,
    });

    const agencies = getAgencies();
    expect(agencies).toHaveLength(1);
    expect(agencies[0].agency_id).toBe('CFG1');

    const routes = getRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0].agency_id).toBe('CFG1');

    const fareAttributes = getFareAttributes();
    expect(fareAttributes).toHaveLength(1);
    expect(fareAttributes[0].agency_id).toBe('CFG1');

    const attributions = getAttributions();
    expect(attributions).toHaveLength(1);
    expect(attributions[0].agency_id).toBe('CFG1');
  });

  it('should use agency.txt agency_id when it differs from config `agencyId` and warn', async () => {
    fixturePath = await createGtfsFixture({
      'agency.txt':
        'agency_id,agency_name,agency_url,agency_timezone\n' +
        'ACT1,Test Agency,http://example.com,America/New_York',
      'routes.txt': 'route_id,agency_id,route_type\nR1,,3',
    });

    await importGtfs({
      agencies: [
        { path: fixturePath, fillEmptyAgencyId: true, agencyId: 'CFG1' },
      ],
      verbose: false,
    });

    const agencies = getAgencies();
    expect(agencies).toHaveLength(1);
    expect(agencies[0].agency_id).toBe('ACT1');

    const routes = getRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0].agency_id).toBe('ACT1');
  });

  it('should apply prefix to config-provided agency_id when backfilling agency row', async () => {
    fixturePath = await createGtfsFixture({
      'agency.txt':
        'agency_name,agency_url,agency_timezone\n' +
        'Test Agency,http://example.com,America/New_York',
      'routes.txt': 'route_id,agency_id,route_type\nR1,,3',
    });

    await importGtfs({
      agencies: [
        {
          path: fixturePath,
          fillEmptyAgencyId: true,
          agencyId: 'CFG1',
          prefix: 'X_',
        },
      ],
      verbose: false,
    });

    const agencies = getAgencies();
    expect(agencies).toHaveLength(1);
    expect(agencies[0].agency_id).toBe('X_CFG1');

    const routes = getRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0].route_id).toBe('X_R1');
    expect(routes[0].agency_id).toBe('X_CFG1');
  });
});
