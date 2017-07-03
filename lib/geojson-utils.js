const _ = require('lodash');

function coordsToString(point1, point2) {
  return `${point1[0]},${point1[1]},${point2[0]},${point2[1]}`;
}

function consolidateShapes(shapes) {
  const coordKeys = {};
  const lineStrings = shapes.map(shape => shape.map(point => point.loc));
  let count = 0;
  while (count < lineStrings.length) {
    lineStrings[count].forEach((point, idx) => {
      if (idx < lineStrings[count].length - 1) {
        const key = coordsToString(point, lineStrings[count][idx + 1]);
        if (coordKeys[key]) {
          lineStrings.push(lineStrings[count].splice(idx + 1));
          lineStrings[count].pop();
        } else {
          coordKeys[key] = true;
        }
      }
    });
    count++;
  }

  // Remove lineStrings with no length or with only one point
  return _.filter(lineStrings, lineString => lineString.length > 1);
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
