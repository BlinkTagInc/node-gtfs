import {
  cloneDeep,
  filter,
  groupBy,
  last,
  omit,
  sortBy,
  omitBy,
} from 'lodash-es';
import { feature, featureCollection } from '@turf/helpers';

function isValidLineString(lineString) {
  if (!lineString) {
    return false;
  }

  if (lineString.length <= 1) {
    return false;
  }

  // Reject linestrings with two identical points
  if (
    lineString.length === 2 &&
    lineString[0][0] === lineString[1][0] &&
    lineString[0][1] === lineString[1][1]
  ) {
    return false;
  }

  return true;
}

function consolidateShapes(shapes) {
  const keys = new Set();
  const segmentsArray = shapes.map((shape) =>
    shape.reduce((memo, point, idx) => {
      if (idx > 0) {
        memo.push([
          [shape[idx - 1].shape_pt_lon, shape[idx - 1].shape_pt_lat],
          [point.shape_pt_lon, point.shape_pt_lat],
        ]);
      }

      return memo;
    }, [])
  );

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

  return filter(consolidatedLineStrings, isValidLineString);
}

function formatHexColor(color) {
  if (color === null || color === undefined) {
    return;
  }

  return `#${color}`;
}

function formatProperties(properties) {
  const formattedProperties = {
    ...cloneDeep(omitBy(properties, (value) => value === null)),
    route_color: formatHexColor(properties.route_color),
    route_text_color: formatHexColor(properties.route_text_color),
  };

  if (properties.routes) {
    formattedProperties.routes = properties.routes.map((route) =>
      formatProperties(route)
    );
  }

  return formattedProperties;
}

export function shapesToGeoJSONFeatures(shapes, properties = {}) {
  const shapeGroups = Object.values(groupBy(shapes, 'shape_id')).map(
    (shapeGroup) => sortBy(shapeGroup, 'shape_pt_sequence')
  );
  const lineStrings = consolidateShapes(shapeGroups);

  return lineStrings.map((lineString) =>
    feature(
      {
        type: 'LineString',
        coordinates: lineString,
      },
      formatProperties(properties)
    )
  );
}

export function stopsToGeoJSON(stops) {
  const features = stops.map((stop) =>
    feature(
      {
        type: 'Point',
        coordinates: [stop.stop_lon, stop.stop_lat],
      },
      formatProperties(omit(stop, ['stop_lat', 'stop_lon']))
    )
  );

  return featureCollection(features);
}
