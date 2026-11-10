import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type {
  Agency,
  Routes,
  Shapes,
  Stops,
} from '../../src/schema/row-types.ts';
import {
  createRouteGeoJSONFeature,
  createRouteShape,
  createShapeGeoJSONFeature,
  createStopsGeoJSONFeatureCollection,
} from '../../src/geojson/features.ts';
import {
  createRouteFeatureCollection,
  createShapeFeatureCollection,
  createStopFeatureCollection,
} from '../../src/geojson/geojson.ts';
import type {
  ShapesGeoJSONData,
  StopsGeoJSONData,
} from '../../src/geojson/data.ts';

function routeFeature<Properties extends object>(
  groups: readonly (readonly Shapes[])[],
  properties: Properties,
) {
  return createRouteGeoJSONFeature(
    groups.flatMap((points) => {
      const shape = createRouteShape(points);
      return shape === undefined ? [] : [shape];
    }),
    properties,
  );
}

function routeCollection(data: ShapesGeoJSONData) {
  const groups = new Map<string, Shapes[]>();
  for (const point of data.shapes) {
    const key = JSON.stringify([point.source_id, point.shape_id]);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [point]);
    } else {
      group.push(point);
    }
  }
  return createRouteFeatureCollection({
    ...data,
    shapes: [...groups.values()].flatMap((points) => {
      const shape = createRouteShape(points);
      return shape === undefined ? [] : [shape];
    }),
  });
}

function stop(
  sourceId: string,
  longitude: number | null,
  latitude: number | null,
): Stops {
  return {
    source_id: sourceId,
    stop_id: 'stop',
    stop_name: 'Stop',
    stop_lon: longitude,
    stop_lat: latitude,
    stop_desc: null,
  } as Stops;
}

function points(
  coordinates: readonly (readonly [number | null, number | null])[],
  shapeId = 'shape',
  sourceId = 'source',
): Shapes[] {
  return coordinates.map(
    ([longitude, latitude], index) =>
      ({
        source_id: sourceId,
        shape_id: shapeId,
        shape_pt_sequence: index + 1,
        shape_pt_lon: longitude,
        shape_pt_lat: latitude,
      }) as Shapes,
  );
}

function route(
  sourceId = 'source',
  routeId = 'route',
  agencyId: string | null = 'agency',
): Routes {
  return {
    source_id: sourceId,
    route_id: routeId,
    agency_id: agencyId,
    route_type: 3,
    route_short_name: '1',
    route_color: 'FF0000',
    route_text_color: 'FFFFFF',
    route_desc: null,
  } as Routes;
}

function agency(
  sourceId = 'source',
  agencyId: string | null = 'agency',
  name = 'Transit',
): Agency {
  return {
    source_id: sourceId,
    agency_id: agencyId,
    agency_name: name,
  } as Agency;
}

function shapeData(): ShapesGeoJSONData {
  return {
    agencyRows: [agency()],
    routes: [route()],
    routeAttributes: [],
    shapeRoutes: [
      { source_id: 'source', shape_id: 'shape', route_id: 'route' },
    ],
    shapes: points([
      [0, 0],
      [1, 1],
    ]),
  };
}

function stopData(): StopsGeoJSONData {
  return {
    agencyRows: [agency()],
    routes: [route()],
    routeAttributes: [],
    stopAttributes: [],
    stops: [stop('source', 0, 0)],
    stopRoutes: [{ source_id: 'source', stop_id: 'stop', route_id: 'route' }],
  };
}

describe('GeoJSON geometry', () => {
  test('compacts ordered route coordinates without changing precision, gaps, or input rows', () => {
    const input = points([
      [-0, 1.0000000000000002],
      [null, 0],
      [2, 2],
    ]).reverse();
    const original = structuredClone(input);
    const shape = createRouteShape(input);
    assert.ok(shape);
    assert.equal(shape.source_id, 'source');
    assert.equal(shape.shape_id, 'shape');
    assert.deepEqual(
      [...shape.coordinates],
      [-0, 1.0000000000000002, NaN, 0, 2, 2],
    );
    assert.deepEqual(input, original);
    assert.equal(createRouteShape([]), undefined);
  });

  test('keeps zero coordinates and excludes null, non-finite, and out-of-range stop coordinates', () => {
    const collection = createStopsGeoJSONFeatureCollection([
      stop('source', 0, 0),
      stop('source', null, 0),
      stop('source', 0, null),
      stop('source', NaN, 0),
      stop('source', 0, Infinity),
      stop('source', 181, 0),
      stop('source', 0, -91),
    ]);
    assert.deepEqual(
      collection.features.map((item) => item.geometry.coordinates),
      [[0, 0]],
    );
    assert.equal('stop_lon' in collection.features[0]!.properties, false);
    assert.equal('stop_desc' in collection.features[0]!.properties, false);
  });

  for (const coordinates of [
    [],
    [[0, 0]],
    [
      [0, 0],
      [0, 0],
    ],
  ] as const) {
    test(`omits degenerate shapes and route lines: ${JSON.stringify(coordinates)}`, () => {
      assert.equal(
        createShapeGeoJSONFeature(points(coordinates), {}),
        undefined,
      );
      assert.equal(routeFeature([points(coordinates)], {}), undefined);
    });
  }

  test('sorts by sequence and preserves loops and retraced shape segments', () => {
    const coordinates = [
      [0, 0],
      [1, 1],
      [2, 2],
      [1, 1],
      [0, 0],
    ] as const;
    const input = points(coordinates).reverse();
    const shape = createShapeGeoJSONFeature(input, { shape_id: 'shape' });
    assert.equal(shape?.geometry.type, 'LineString');
    assert.deepEqual(shape?.geometry.coordinates, coordinates);
    assert.equal(input[0]?.shape_pt_sequence, 5);
  });

  test('removes only consecutive identical points from an individual shape', () => {
    const shape = createShapeGeoJSONFeature(
      points([
        [0, 0],
        [0, 0],
        [1, 1],
        [1, 1],
        [0, 0],
      ]),
      {},
    );
    assert.deepEqual(shape?.geometry.coordinates, [
      [0, 0],
      [1, 1],
      [0, 0],
    ]);
  });

  for (const invalid of [
    [null, null],
    [NaN, 0],
    [Infinity, 0],
    [0, 91],
  ] as const) {
    test(`does not bridge an invalid shape position: ${String(invalid)}`, () => {
      const input = points([[0, 0], [1, 1], invalid, [3, 3], [4, 4]]);
      assert.equal(createShapeGeoJSONFeature(input, {}), undefined);
      assert.deepEqual(routeFeature([input], {})?.geometry.coordinates, [
        [
          [0, 0],
          [1, 1],
        ],
        [
          [3, 3],
          [4, 4],
        ],
      ]);
    });
  }

  test('deduplicates reverse and repeated route segments without joining disconnected lines', () => {
    const feature = routeFeature(
      [
        points(
          [
            [0, 0],
            [1, 1],
            [2, 2],
          ],
          'outbound',
        ),
        points(
          [
            [2, 2],
            [1, 1],
            [3, 3],
            [1, 1],
            [4, 4],
          ],
          'inbound',
        ),
        points(
          [
            [8, 8],
            [9, 9],
          ],
          'branch',
        ),
      ],
      {},
    );
    assert.deepEqual(feature?.geometry.coordinates, [
      [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
      [
        [1, 1],
        [3, 3],
      ],
      [
        [1, 1],
        [4, 4],
      ],
      [
        [8, 8],
        [9, 9],
      ],
    ]);
  });

  test('does not snap nearly identical route segments', () => {
    const feature = routeFeature(
      [
        points([
          [0, 0],
          [1, 1],
        ]),
        points([
          [0, 0],
          [1, 1.000001],
        ]),
      ],
      {},
    );
    assert.equal(feature?.geometry.coordinates.length, 2);
  });
});

describe('GeoJSON feature properties and grouping', () => {
  test('keeps stops without serving routes and shapes without trips', () => {
    const stops = createStopFeatureCollection({
      ...stopData(),
      routes: [],
      stopRoutes: [],
    });
    assert.equal(stops.features.length, 1);
    assert.deepEqual(stops.features[0]?.properties.routes, []);
    assert.equal('agency_name' in stops.features[0]!.properties, false);
    const shapes = createShapeFeatureCollection({
      ...shapeData(),
      routes: [],
      shapeRoutes: [],
    });
    assert.equal(shapes.features.length, 1);
    assert.deepEqual(shapes.features[0]?.properties.routes, []);
  });

  for (const missing of ['routes', 'shapeRoutes', 'shapes'] as const) {
    test(`omits route features without ${missing}`, () => {
      assert.deepEqual(
        routeCollection({ ...shapeData(), [missing]: [] }).features,
        [],
      );
    });
  }

  test('returns one shape shared by two routes, but one feature for each route', () => {
    const data = shapeData();
    const shared = {
      ...data,
      routes: [route(), route('source', 'other')],
      shapeRoutes: [
        ...data.shapeRoutes,
        { source_id: 'source', shape_id: 'shape', route_id: 'other' },
      ],
    };
    const shapes = createShapeFeatureCollection(shared);
    assert.equal(shapes.features.length, 1);
    assert.deepEqual(
      shapes.features[0]?.properties.routes.map((row) => row.route_id),
      ['other', 'route'],
    );
    assert.equal('route_id' in shapes.features[0]!.properties, false);
    assert.equal(routeCollection(shared).features.length, 2);
  });

  test('formats route colors, omits nulls, and includes typed extension properties at every level', () => {
    const attributes = [
      {
        source_id: 'source',
        route_id: 'route',
        category: 1,
        subcategory: 101,
        running_way: 1,
      },
    ];
    const routes = routeCollection({
      ...shapeData(),
      routeAttributes: attributes,
    });
    const shapes = createShapeFeatureCollection({
      ...shapeData(),
      routeAttributes: attributes,
    });
    const stops = createStopFeatureCollection({
      ...stopData(),
      routeAttributes: attributes,
      stopAttributes: [
        {
          source_id: 'source',
          stop_id: 'stop',
          accessibility_id: null,
          cardinal_direction: null,
          relative_position: null,
          stop_city: 'City',
        },
      ],
    });
    for (const properties of [
      routes.features[0]!.properties,
      shapes.features[0]!.properties.routes[0]!,
      stops.features[0]!.properties.routes[0]!,
    ]) {
      assert.equal(properties.route_color, '#FF0000');
      assert.equal(properties.route_text_color, '#FFFFFF');
      assert.equal(properties.category, 1);
      assert.equal(properties.agency_name, 'Transit');
      assert.equal('route_desc' in properties, false);
    }
    assert.equal(stops.features[0]?.properties.stop_city, 'City');
    assert.equal('accessibility_id' in stops.features[0]!.properties, false);
  });

  test('does not choose one agency for a stop or shape serving multiple agencies with the same name', () => {
    const shared = {
      agencyRows: [agency(), agency('source', 'second', 'Transit')],
      routes: [route(), route('source', 'second', 'second')],
    };
    const stops = createStopFeatureCollection({
      ...stopData(),
      ...shared,
      stopRoutes: [
        ...stopData().stopRoutes,
        { source_id: 'source', stop_id: 'stop', route_id: 'second' },
      ],
    });
    const shapes = createShapeFeatureCollection({
      ...shapeData(),
      ...shared,
      shapeRoutes: [
        ...shapeData().shapeRoutes,
        { source_id: 'source', shape_id: 'shape', route_id: 'second' },
      ],
    });
    for (const properties of [
      stops.features[0]!.properties,
      shapes.features[0]!.properties,
    ]) {
      assert.equal('agency_name' in properties, false);
      assert.deepEqual(
        properties.routes.map((row) => row.agency_id),
        ['agency', 'second'],
      );
    }
  });

  test('resolves an omitted route agency_id only when its source has one agency', () => {
    for (const agencyRows of [
      [agency()],
      [agency(), agency('source', 'second')],
      [],
    ]) {
      const collection = routeCollection({
        ...shapeData(),
        routes: [route('source', 'route', null)],
        agencyRows,
      });
      assert.equal(
        collection.features[0]?.properties.agency_name,
        agencyRows.length === 1 ? 'Transit' : undefined,
      );
    }
  });

  test('keeps same IDs from different sources isolated in every projection', () => {
    const sources = ['alpha', 'beta'];
    const shared = {
      agencyRows: sources.map((id) => agency(id, 'agency', id)),
      routes: sources.map((id) => route(id)),
      routeAttributes: [],
    };
    const shapeRows = {
      ...shared,
      shapes: sources.flatMap((id, i) =>
        points(
          [
            [i * 10, 0],
            [i * 10 + 1, 1],
          ],
          'shape',
          id,
        ),
      ),
      shapeRoutes: sources.map((id) => ({
        source_id: id,
        shape_id: 'shape',
        route_id: 'route',
      })),
    };
    const stops = createStopFeatureCollection({
      ...shared,
      stopAttributes: [],
      stops: sources.map((id, i) => stop(id, i * 10, 0)),
      stopRoutes: sources.map((id) => ({
        source_id: id,
        stop_id: 'stop',
        route_id: 'route',
      })),
    });
    const shapes = createShapeFeatureCollection(shapeRows);
    const routes = routeCollection(shapeRows);
    for (const collection of [stops, shapes, routes]) {
      assert.deepEqual(
        collection.features.map((item) => item.properties.source_id),
        sources,
      );
      assert.deepEqual(
        collection.features.map((item) => item.properties.agency_name),
        sources,
      );
    }
    assert.deepEqual(
      shapes.features.map((item) => item.geometry.coordinates),
      [
        [
          [0, 0],
          [1, 1],
        ],
        [
          [10, 0],
          [11, 1],
        ],
      ],
    );
    assert.deepEqual(
      routes.features.map((item) => item.geometry.coordinates),
      [
        [
          [
            [0, 0],
            [1, 1],
          ],
        ],
        [
          [
            [10, 0],
            [11, 1],
          ],
        ],
      ],
    );
    assert.deepEqual(
      stops.features.map((item) => item.properties.routes[0]?.source_id),
      sources,
    );
  });
});
