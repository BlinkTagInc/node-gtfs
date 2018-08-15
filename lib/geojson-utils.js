const _ = require('lodash');

function coordsToString(point1, point2) {
  return `${point1[0]},${point1[1]},${point2[0]},${point2[1]}`;
}

function consolidateShapes(shapes) {
  const segments = new Set();
  const lineStrings = shapes.map(shape => shape.map(point => point.loc));
  const consolidatedLineStrings = [[]];

  for (const lineString of lineStrings) {
    for (const [idx, point] of lineString.entries()) {
      _.last(consolidatedLineStrings).push(point);

      if (idx < lineString.length - 1) {
        const key = coordsToString(point, lineString[idx + 1]);

        if (segments.has(key)) {
          consolidatedLineStrings.push([]);
        } else {
          segments.add(key);
        }
      }
    }
  }

  // Remove lineStrings with no length or with only one point
  return _.filter(_.compact(consolidatedLineStrings), lineString => lineString.length > 1);
}

exports.shapesToGeoJSONFeatures = (shapes, properties = {}) => {
  const lineStrings = consolidateShapes(shapes);

  return lineStrings.map(lineString => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: lineString
    },
    properties
  }));
};

exports.stopsToGeoJSONFeatures = stops => {
  return stops.map(stop => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: stop.loc
    },
    properties: _.omit(stop, ['loc', '_id', 'stop_lat', 'stop_lon'])
  }));
};

exports.featuresToGeoJSON = features => ({
  type: 'FeatureCollection',
  features
});
