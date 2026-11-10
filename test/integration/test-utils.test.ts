import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import {
  countCsvRows,
  countFeedInventory,
  createFeedFixture,
} from '../helpers/test-utils.ts';

test('strict CSV row counts distinguish missing, empty, header-only, and populated files', async (t) => {
  const fixture = await createFeedFixture({
    base: 'none',
    extraFiles: {
      'empty.txt': '',
      'header.txt': 'id,name\n',
      'rows.txt': 'id,name\n1,"Unicode café, quoted"\n2,"embedded\nnewline"\n',
      'invalid.txt': 'id,name\n1,"unterminated\n',
    },
  });
  t.after(fixture.cleanup);
  assert.equal(await countCsvRows(path.join(fixture.path, 'empty.txt')), 0);
  assert.equal(await countCsvRows(path.join(fixture.path, 'header.txt')), 0);
  assert.equal(await countCsvRows(path.join(fixture.path, 'rows.txt')), 2);
  await assert.rejects(countCsvRows(path.join(fixture.path, 'missing.txt')), {
    code: 'ENOENT',
  });
  await assert.rejects(countCsvRows(path.join(fixture.path, 'invalid.txt')), {
    code: 'CSV_QUOTE_NOT_CLOSED',
  });
});

test('feed inventories intentionally count absent optional files as zero', async (t) => {
  const fixture = await createFeedFixture({
    base: 'none',
    extraFiles: {
      'routes.txt': 'route_id\nred\nblue\n',
      'locations.geojson':
        '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":null,"properties":{}}]}',
    },
  });
  t.after(fixture.cleanup);
  assert.deepEqual(
    await countFeedInventory(fixture.path, {
      routes: { filename: 'routes.txt' },
      shapes: { filename: 'shapes.txt' },
      locations: { filename: 'locations.geojson' },
      missingGeoJSON: { filename: 'missing.geojson' },
      alerts: { filename: null },
    }),
    { routes: 2, shapes: 0, locations: 1, missingGeoJSON: 0 },
  );
  await assert.rejects(
    countFeedInventory(path.join(fixture.path, 'missing'), {}),
    { code: 'ENOENT' },
  );
});

test('feed inventory does not hide malformed files as zero rows', async (t) => {
  const fixture = await createFeedFixture({
    base: 'none',
    extraFiles: {
      'invalid.txt': 'id\n"unterminated\n',
      'invalid.geojson': '{}',
    },
  });
  t.after(fixture.cleanup);
  await assert.rejects(
    countFeedInventory(fixture.path, { invalid: { filename: 'invalid.txt' } }),
    { code: 'CSV_QUOTE_NOT_CLOSED' },
  );
  await assert.rejects(
    countFeedInventory(fixture.path, {
      invalid: { filename: 'invalid.geojson' },
    }),
    /Expected a GeoJSON FeatureCollection/,
  );
});
