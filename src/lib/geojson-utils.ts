import {
  cloneDeep,
  compact,
  filter,
  groupBy,
  last,
  omit,
  sortBy,
  omitBy,
} from 'lodash-es';
import { feature, featureCollection } from '@turf/helpers';
import { Shape, Stop } from '../types/global_interfaces.ts';

export function isValidJSON(string: string) {
  try {
    JSON.parse(string);
  } catch (error) {
    return false;
  }
  return true;
}

type Position = [number, number];

function isValidLineString(lineString?: Position[]) {
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

function consolidateShapes(shapeGroups: Shape[][]) {
  const keys = new Set();
  const segmentsArray = shapeGroups.map((shapes) =>
    shapes.reduce(
      (
        memo: any[][][],
        point: { shape_pt_lon: number; shape_pt_lat: number },
        idx: number,
      ) => {
        if (idx > 0) {
          memo.push([
            [shapes[idx - 1].shape_pt_lon, shapes[idx - 1].shape_pt_lat],
            [point.shape_pt_lon, point.shape_pt_lat],
          ]);
        }

        return memo;
      },
      [],
    ),
  );

  const consolidatedLineStrings: number[][][] = [];

  for (const segments of segmentsArray) {
    consolidatedLineStrings.push([]);

    for (const segment of segments) {
      const key1 = `${segment[0][0]},${segment[0][1]},${segment[1][0]},${segment[1][1]}`;
      const key2 = `${segment[1][0]},${segment[1][1]},${segment[0][0]},${segment[0][1]}`;
      const currentLine: number[][] | undefined = last(consolidatedLineStrings);

      if (keys.has(key1) || keys.has(key2)) {
        consolidatedLineStrings.push([]);
      } else {
        // If its the first segment in a linestring, add both points
        if (currentLine?.length === 0) {
          currentLine.push(segment[0]);
        }

        currentLine?.push(segment[1]);
        keys.add(key1);
        keys.add(key2);
      }
    }
  }

  return filter(consolidatedLineStrings, isValidLineString);
}

function formatHexColor(color: null | undefined) {
  if (color === null || color === undefined) {
    return;
  }

  return `#${color}`;
}

function formatProperties(properties: Record<string, any>) {
  const formattedProperties: Record<string, any> = cloneDeep(
    omitBy(properties, (value) => value === null || value === undefined),
  );
  const formattedRouteColor = formatHexColor(properties.route_color);
  const formattedRouteTextColor = formatHexColor(properties.route_text_color);

  if (formattedRouteColor) {
    formattedProperties.route_color = formattedRouteColor;
  }

  if (formattedRouteTextColor) {
    formattedProperties.route_text_color = formattedRouteTextColor;
  }

  if (properties.routes) {
    formattedProperties.routes = properties.routes.map(
      (route: Record<string, any>) => formatProperties(route),
    );
  }

  return formattedProperties;
}

export function shapesToGeoJSONFeature(shapes: Shape[], properties = {}) {
  const shapeGroups = Object.values(groupBy(shapes, 'shape_id')).map(
    (shapeGroup) => sortBy(shapeGroup, 'shape_pt_sequence'),
  );
  const lineStrings = consolidateShapes(shapeGroups) as Position[][];

  return feature(
    {
      type: 'MultiLineString',
      coordinates: lineStrings,
    },
    formatProperties(properties),
  );
}

export function stopsToGeoJSONFeatureCollection(stops: Stop[]) {
  const features = compact(
    stops.map((stop) => {
      if (!stop.stop_lon || !stop.stop_lat) {
        return;
      }

      return feature(
        {
          type: 'Point',
          coordinates: [stop.stop_lon, stop.stop_lat],
        },
        formatProperties(omit(stop, ['stop_lat', 'stop_lon'])),
      );
    }),
  );

  return featureCollection(features);
}
