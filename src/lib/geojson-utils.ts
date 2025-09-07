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

/** Represents a GeoJSON coordinate pair [longitude, latitude] */
type Position = [number, number];

/**
 * Validates if a string is valid JSON
 * @param {string} string - The string to validate as JSON
 * @returns {boolean} True if string is valid JSON, false otherwise
 * @example
 * isValidJSON('{"key": "value"}') // returns true
 * isValidJSON('invalid json') // returns false
 */
export function isValidJSON(string: string): boolean {
  try {
    JSON.parse(string);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates if an array of positions forms a valid LineString
 * @param {Position[]} [lineString] - Array of coordinate pairs
 * @returns {boolean} True if lineString is valid, false otherwise
 */
function isValidLineString(lineString?: Position[]): boolean {
  if (!lineString || lineString.length <= 1) {
    return false;
  }

  // Reject linestrings with two identical points
  if (lineString.length === 2) {
    const [[x1, y1], [x2, y2]] = lineString;
    return !(x1 === x2 && y1 === y2);
  }

  return true;
}

/**
 * Consolidates shape groups into unique line segments
 * @param {Shape[][]} shapeGroups - Array of shape point groups
 * @returns {Position[][]} Array of consolidated line strings
 */
function consolidateShapes(shapeGroups: Shape[][]): Position[][] {
  const keys = new Set<string>();
  const segmentsArray = shapeGroups.map((shapes) =>
    shapes.reduce<Position[][]>((memo, point, idx) => {
      if (idx > 0) {
        const prevPoint = shapes[idx - 1];
        memo.push([
          [prevPoint.shape_pt_lon, prevPoint.shape_pt_lat],
          [point.shape_pt_lon, point.shape_pt_lat],
        ]);
      }
      return memo;
    }, []),
  );

  const consolidatedLineStrings: Position[][] = [];

  for (const segments of segmentsArray) {
    consolidatedLineStrings.push([]);

    for (const segment of segments) {
      const key1 = segment.flat().join(',');
      const key2 = segment.reverse().flat().join(',');
      const currentLine = last(consolidatedLineStrings);

      if (!currentLine || keys.has(key1) || keys.has(key2)) {
        consolidatedLineStrings.push([]);
        continue;
      }

      if (currentLine.length === 0) {
        currentLine.push(segment[0]);
      }
      currentLine.push(segment[1]);
      keys.add(key1);
      keys.add(key2);
    }
  }

  return filter(consolidatedLineStrings, isValidLineString);
}

/**
 * Formats a color string to hex format
 * @param {string | null | undefined} color - Color string to format
 * @returns {string | undefined} Formatted hex color or undefined
 * @example
 * formatHexColor('FF0000') // returns '#FF0000'
 */
function formatHexColor(color: string | null | undefined): string | undefined {
  if (!color) return undefined;
  return `#${color}`;
}

/**
 * Formats properties object by cleaning null values and formatting colors
 * @param {Record<string, unknown>} properties - Properties object to format
 * @returns {Record<string, unknown>} Formatted properties object
 */
function formatProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  const formattedProperties = cloneDeep(
    omitBy(properties, (value) => value == null),
  );

  const formattedRouteColor = formatHexColor(properties.route_color);
  const formattedRouteTextColor = formatHexColor(properties.route_text_color);

  if (formattedRouteColor) {
    formattedProperties.route_color = formattedRouteColor;
  }

  if (formattedRouteTextColor) {
    formattedProperties.route_text_color = formattedRouteTextColor;
  }

  if (properties.routes && Array.isArray(properties.routes)) {
    formattedProperties.routes = properties.routes.map(
      (route: Record<string, unknown>) => formatProperties(route),
    );
  }

  return formattedProperties;
}

/**
 * Converts GTFS shapes to GeoJSON Feature
 * @param {Shape[]} shapes - Array of GTFS shapes
 * @param {Record<string, any>} [properties={}] - Properties to add to the feature
 * @returns {Feature} GeoJSON Feature with MultiLineString geometry
 */
export function shapesToGeoJSONFeature(
  shapes: Shape[],
  properties: Record<string, unknown> = {},
) {
  const shapeGroups = Object.values(groupBy(shapes, 'shape_id')).map(
    (shapeGroup) => sortBy(shapeGroup, 'shape_pt_sequence'),
  );

  const lineStrings = consolidateShapes(shapeGroups);

  return feature(
    {
      type: 'MultiLineString',
      coordinates: lineStrings,
    },
    formatProperties(properties),
  );
}

/**
 * Converts GTFS stops to GeoJSON FeatureCollection
 * @param {Stop[]} stops - Array of GTFS stops
 * @returns {FeatureCollection} GeoJSON FeatureCollection of Point features
 */
export function stopsToGeoJSONFeatureCollection(stops: Stop[]) {
  const features = compact(
    stops.map((stop) => {
      if (!stop.stop_lon || !stop.stop_lat) {
        return undefined;
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
