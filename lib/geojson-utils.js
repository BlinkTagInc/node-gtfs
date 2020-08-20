const {
  compact,
  filter,
  groupBy,
  last,
  omit,
  sortBy,
  omitBy
} = require('lodash');

function consolidateShapes(shapes) {
  const keys = new Set();
  /* eslint-disable unicorn/no-reduce */
  const segmentsArray = shapes.map(shape => shape.reduce((memo, point, idx) => {
    if (idx > 0) {
      memo.push([
        [
          shape[idx - 1].shape_pt_lon,
          shape[idx - 1].shape_pt_lat
        ],
        [
          point.shape_pt_lon,
          point.shape_pt_lat
        ]
      ]);
    }

    return memo;
  }, []));
  /* eslint-enable unicorn/no-reduce */
  const consolidatedLineStrings = [];

  for (const segments of segmentsArray) {
    consolidatedLineStrings.push([]);

    for (const segment of segments) {
      const key1 = `${segment[0][0]},${segment[0][1]},${segment[1][0]},${segment[1][1]}`;
      const key2 = `${segment[1][0]},${segment[1][1]},${segment[0][0]},${segment[0][1]}`;
      const currentLine = last(consolidatedLineStrings);

      if (keys.has(key1) || keys.has(key2)) {
        consolidatedLineStrings.push([]);
      } else {
        // If its the first segment in a linestring, add both points
        if (currentLine.length === 0) {
          currentLine.push(segment[0]);
        }

        currentLine.push(segment[1]);
        keys.add(key1);
        keys.add(key2);
      }
    }
  }

  // Remove lineStrings with no length or with only one point
  return filter(compact(consolidatedLineStrings), lineString => lineString.length > 1);
}

function formatHexColor(color) {
  if (color === null || color === undefined) {
    return;
  }

  return `#${color}`;
}

function formatProperties(properties) {
  properties.route_color = formatHexColor(properties.route_color);
  properties.route_text_color = formatHexColor(properties.route_text_color);

  if (properties.routes) {
    properties.routes = properties.routes.map(route => formatProperties(route));
  }

  return omitBy(properties, value => value === null);
}

exports.shapesToGeoJSONFeatures = (shapes, properties = {}) => {
  const shapeGroups = Object.values(groupBy(shapes, 'shape_id')).map(shapeGroup => sortBy(shapeGroup, 'shape_pt_sequence'));
  const lineStrings = consolidateShapes(shapeGroups);

  const formattedProperties = formatProperties(properties);

  return lineStrings.map(lineString => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: lineString
    },
    properties: formattedProperties
  }));
};

exports.stopsToGeoJSONFeatures = stops => {
  return stops.map(stop => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [
        stop.stop_lon,
        stop.stop_lat
      ]
    },
    properties: formatProperties(omit(stop, ['stop_lat', 'stop_lon']))
  }));
};

exports.featuresToGeoJSON = features => ({
  type: 'FeatureCollection',
  features
});
