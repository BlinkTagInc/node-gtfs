import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

import { importGtfs } from '../../src/index.ts';
import { afterEach, beforeEach, describe, it } from 'node:test';

let sqlite: Database.Database;
const rows = (table: string) =>
  sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];

async function createGtfsFixture(
  files: Record<string, string>,
): Promise<string> {
  const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-default-agency-'));
  for (const [filename, content] of Object.entries(files)) {
    await writeFile(path.join(directory, filename), content);
  }
  return directory;
}

describe('schedule.defaultAgencyId', () => {
  let fixturePath = '';

  beforeEach(() => {
    sqlite = new Database(':memory:');
  });
  afterEach(async () => {
    sqlite.close();
    await rm(fixturePath, { recursive: true, force: true });
  });

  async function importFixture(defaultAgencyId: string): Promise<void> {
    await importGtfs({
      database: { client: sqlite },
      sources: [
        {
          sourceId: 'test',
          schedule: {
            path: fixturePath,
            defaultAgencyId,
            import: {
              validation: {
                mode: 'permissive',
                onUnknownField: 'discard',
              },
            },
          },
        },
      ],
      reporting: { level: 'silent' },
    });
  }

  it('prefers the single agency.txt ID over the configured default', async () => {
    fixturePath = await createGtfsFixture({
      'agency.txt':
        'agency_id,agency_name,agency_url,agency_timezone\n' +
        'ACT1,Test Agency,http://example.com,America/New_York',
      'routes.txt': 'route_id,agency_id,route_type\nR1,,3',
      'fare_attributes.txt':
        'fare_id,agency_id,price,currency_type,payment_method,transfers\n' +
        'F1,,2.50,USD,0,0',
    });

    await importFixture('FALLBACK');
    assert.equal(rows('routes')[0]!.agency_id, 'ACT1');
    assert.equal(rows('fare_attributes')[0]!.agency_id, 'ACT1');
  });

  it('uses the configured default when agency.txt has no agency_id', async () => {
    fixturePath = await createGtfsFixture({
      'agency.txt':
        'agency_name,agency_url,agency_timezone\n' +
        'Test Agency,http://example.com,America/New_York',
      'routes.txt': 'route_id,agency_id,route_type\nR1,,3',
    });

    await importFixture('CFG1');
    assert.equal(rows('agency')[0]!.agency_id, 'CFG1');
    assert.equal(rows('routes')[0]!.agency_id, 'CFG1');
  });

  it('does not add agency_id to route-scoped attributions', async () => {
    fixturePath = await createGtfsFixture({
      'agency.txt':
        'agency_id,agency_name,agency_url,agency_timezone\n' +
        'ACT1,Test Agency,http://example.com,America/New_York',
      'routes.txt': 'route_id,agency_id,route_type\nR1,,3',
      'attributions.txt':
        'attribution_id,organization_name,route_id\nATTR1,Test Org,R1',
    });

    await importFixture('FALLBACK');
    assert.equal(rows('attributions')[0]!.agency_id, null);
  });
});
