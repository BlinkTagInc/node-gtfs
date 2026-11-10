import assert from 'node:assert/strict';

import { describe, test } from 'node:test';

import {
  GtfsErrorCategory,
  GtfsErrorCode,
  isGtfsError,
} from '../../src/diagnostics/errors.ts';
import { parseLocationsGeoJSON } from '../../src/schedule/import/locations.ts';

describe('locations.geojson parser', () => {
  test('accepts closed Polygon and MultiPolygon rings', () => {
    const ring = [
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 0],
    ];
    const rows = parseLocationsGeoJSON(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'polygon',
            properties: { stop_name: 'Polygon' },
            geometry: { type: 'Polygon', coordinates: [ring] },
          },
          {
            type: 'Feature',
            id: 'multipolygon',
            properties: { stop_desc: 'MultiPolygon' },
            geometry: { type: 'MultiPolygon', coordinates: [[[...ring]]] },
          },
        ],
      }),
    );

    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.id, 'polygon');
    assert.equal(rows[1]!.id, 'multipolygon');
  });

  test('reports exact details for malformed roots and feature collections', () => {
    const filename = 'custom-locations.geojson';
    const cases = [
      ['{', 'the document is not valid JSON'],
      ...[null, [], 1, {}, { type: 'Feature' }].map((value) => [
        JSON.stringify(value),
        'the root object must have type FeatureCollection',
      ]),
      ...[undefined, null, {}, 'features'].map((features) => [
        JSON.stringify({ type: 'FeatureCollection', features }),
        'FeatureCollection.features must be an array',
      ]),
    ];
    for (const [data, message] of cases) {
      assert.ok(data !== undefined);
      assert.throws(
        () => parseLocationsGeoJSON(data, filename),
        (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.JSON_INVALID);
          assert.equal(error.category, GtfsErrorCategory.PARSE);
          assert.deepEqual(error.details, { filename });
          assert.equal(
            error.message,
            `Invalid GeoJSON in ${filename}: ${message}`,
          );
          return true;
        },
      );
    }
    assert.deepEqual(
      parseLocationsGeoJSON('{"type":"FeatureCollection","features":[]}'),
      [],
    );
  });

  test('reports the exact field and one-based feature number for malformed features', () => {
    const valid = {
      type: 'Feature',
      id: 'valid',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [0, 0],
          ],
        ],
      },
    };
    const cases: { feature: unknown; field?: string; message: string }[] = [
      ...[null, [], 1, {}, { type: 'Point' }].map((feature) => ({
        feature,
        message: 'feature must have type Feature',
      })),
      ...[undefined, null, '', 1, {}].map((id) => ({
        feature: { ...valid, id },
        field: 'id',
        message: 'feature id must be a string',
      })),
      ...[undefined, null, [], 'properties'].map((properties) => ({
        feature: { ...valid, properties },
        field: 'properties',
        message: 'feature properties must be an object',
      })),
      ...['stop_name', 'stop_desc'].flatMap((field) =>
        [1, false, []].map((value) => ({
          feature: { ...valid, properties: { [field]: value } },
          field,
          message: `${field} must be a string when present`,
        })),
      ),
      ...[
        undefined,
        null,
        [],
        {},
        { type: 'Point', coordinates: [0, 0] },
        { type: 'Polygon', coordinates: [] },
        {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [0, 1],
              [0, 0],
            ],
          ],
        },
        {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [1, 0],
            ],
          ],
        },
        { type: 'Polygon', coordinates: [[[0], [0, 1], [1, 1], [0]]] },
        {
          type: 'Polygon',
          coordinates: [
            [
              ['0', 0],
              [0, 1],
              [1, 1],
              ['0', 0],
            ],
          ],
        },
        { type: 'MultiPolygon', coordinates: [] },
        { type: 'MultiPolygon', coordinates: [[]] },
        { type: 'MultiPolygon', coordinates: [valid.geometry.coordinates, []] },
      ].map((geometry) => ({
        feature: { ...valid, geometry },
        field: 'geometry',
        message: 'feature geometry must be a valid Polygon or MultiPolygon',
      })),
    ];
    for (const { feature, field, message } of cases) {
      const data = JSON.stringify({
        type: 'FeatureCollection',
        features: [valid, feature],
      });
      assert.throws(
        () => parseLocationsGeoJSON(data),
        (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.JSON_INVALID);
          assert.equal(error.category, GtfsErrorCategory.PARSE);
          assert.deepEqual(error.position, {
            kind: 'geojson',
            featureNumber: 2,
          });
          assert.deepEqual(error.details, {
            filename: 'locations.geojson',
            ...(field === undefined ? {} : { field }),
          });
          assert.equal(
            error.message,
            `Invalid GeoJSON in locations.geojson: ${message}`,
          );
          return true;
        },
      );
    }
  });
});
