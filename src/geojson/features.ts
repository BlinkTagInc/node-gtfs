import { compact, sortBy } from 'lodash-es';
import { feature, featureCollection } from '@turf/helpers';
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
} from 'geojson';
import type { Shapes, Stops } from '../schema/row-types.ts';
import type { GeoJSONRowProperties } from './types.ts';

type Position = [number, number];

export interface RouteShape {
  readonly source_id: string;
  readonly shape_id: string;
  readonly coordinates: Float64Array;
}

export function createRouteShape(
  points: readonly Shapes[],
): RouteShape | undefined {
  const first = points[0];
  if (first === undefined) {
    return undefined;
  }
  const coordinates = new Float64Array(points.length * 2);
  for (const [index, point] of sortBy(points, 'shape_pt_sequence').entries()) {
    coordinates[index * 2] = point.shape_pt_lon ?? NaN;
    coordinates[index * 2 + 1] = point.shape_pt_lat ?? NaN;
  }
  return { source_id: first.source_id, shape_id: first.shape_id, coordinates };
}

function samePosition(left: Position, right: Position): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function getShapePosition(point: Shapes): Position | undefined {
  return getGeoJSONPosition(point.shape_pt_lon, point.shape_pt_lat);
}

export function getGeoJSONPosition(
  longitude: number | null,
  latitude: number | null,
): Position | undefined {
  if (
    longitude !== null &&
    latitude !== null &&
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  ) {
    return [longitude, latitude];
  }
  return undefined;
}

function getUndirectedSegmentKey(first: Position, second: Position): string {
  const [x1, y1] = first;
  const [x2, y2] = second;
  return x1 < x2 || (x1 === x2 && y1 <= y2)
    ? `${x1},${y1},${x2},${y2}`
    : `${x2},${y2},${x1},${y1}`;
}

function buildUniqueLineStrings(
  shapeGroups: readonly RouteShape[],
): Position[][] {
  const keys = new Set<string>();
  const lineStrings: Position[][] = [];

  for (const shapeGroup of shapeGroups) {
    let currentLine: Position[] = [];
    let previousPosition: Position | undefined;
    const finishCurrentLine = (): void => {
      if (currentLine.length > 1) {
        lineStrings.push(currentLine);
      }
      currentLine = [];
    };

    const coordinates = shapeGroup.coordinates;
    for (let index = 0; index < coordinates.length; index += 2) {
      const position = getGeoJSONPosition(
        coordinates[index] ?? null,
        coordinates[index + 1] ?? null,
      );
      if (position === undefined) {
        finishCurrentLine();
        previousPosition = undefined;
        continue;
      }
      if (previousPosition === undefined) {
        previousPosition = position;
        continue;
      }

      if (samePosition(previousPosition, position)) {
        previousPosition = position;
        continue;
      }

      const key = getUndirectedSegmentKey(previousPosition, position);
      if (keys.has(key)) {
        finishCurrentLine();
        previousPosition = position;
        continue;
      }

      if (currentLine.length === 0) {
        currentLine.push(previousPosition);
      } else {
        const currentEnd = currentLine.at(-1);
        if (
          currentEnd !== undefined &&
          !samePosition(currentEnd, previousPosition)
        ) {
          finishCurrentLine();
          currentLine.push(previousPosition);
        }
      }
      currentLine.push(position);
      keys.add(key);
      previousPosition = position;
    }
    finishCurrentLine();
  }

  return lineStrings;
}

export function omitNullGeoJSONProperties<Row extends object>(
  properties: Row,
): GeoJSONRowProperties<Row> {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value != null),
  ) as GeoJSONRowProperties<Row>;
}

export function createRouteGeoJSONFeature<Properties extends object>(
  shapeGroups: readonly RouteShape[],
  properties: Properties,
): Feature<MultiLineString, Properties> | undefined {
  const lineStrings = buildUniqueLineStrings(shapeGroups);
  if (lineStrings.length === 0) {
    return undefined;
  }

  return feature(
    {
      type: 'MultiLineString',
      coordinates: lineStrings,
    },
    properties,
  );
}

export function createShapeGeoJSONFeature<Properties extends object>(
  points: readonly Shapes[],
  properties: Properties,
): Feature<LineString, Properties> | undefined {
  const coordinates: Position[] = [];
  for (const point of sortBy(points, 'shape_pt_sequence')) {
    const position = getShapePosition(point);
    // A LineString cannot represent a gap without inventing a connecting segment.
    if (position === undefined) {
      return undefined;
    }
    const previous = coordinates.at(-1);
    if (previous === undefined || !samePosition(previous, position)) {
      coordinates.push(position);
    }
  }
  if (coordinates.length < 2) {
    return undefined;
  }
  return feature({ type: 'LineString', coordinates }, properties);
}

export function createStopsGeoJSONFeatureCollection<Row extends Stops>(
  stops: readonly Row[],
): FeatureCollection<
  Point,
  GeoJSONRowProperties<Omit<Row, 'stop_lat' | 'stop_lon'>>
> {
  const features = compact(
    stops.map((stop) => {
      const { stop_lon, stop_lat, ...properties } = stop;
      const coordinates = getGeoJSONPosition(stop_lon, stop_lat);
      if (coordinates === undefined) {
        return undefined;
      }

      return feature(
        {
          type: 'Point',
          coordinates,
        },
        omitNullGeoJSONProperties(properties),
      );
    }),
  );

  return featureCollection(features);
}
