import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../../diagnostics/errors.ts';
import type { GtfsGeoJSONSourcePosition } from '../../diagnostics/position.ts';

interface ParsedLocationFeature {
  readonly id: string;
  readonly stop_name?: string;
  readonly stop_desc?: string;
  readonly geometry: Readonly<Record<string, unknown>>;
  readonly [property: string]: unknown;
}

function throwInvalidLocationsGeoJSON(
  filename: string,
  message: string,
  context: {
    readonly position?: GtfsGeoJSONSourcePosition;
    readonly field?: string;
  } = {},
): never {
  throw new GtfsError(`Invalid GeoJSON in ${filename}: ${message}`, {
    code: GtfsErrorCode.JSON_INVALID,
    category: GtfsErrorCategory.PARSE,
    ...(context.position === undefined ? {} : { position: context.position }),
    details: {
      filename,
      ...(context.field === undefined ? {} : { field: context.field }),
    },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPosition(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every(
      (coordinate) =>
        typeof coordinate === 'number' && Number.isFinite(coordinate),
    )
  );
}

function positionsEqual(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return (
    left.length === right.length &&
    left.every((coordinate, index) => coordinate === right[index])
  );
}

function isLinearRing(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 4 || !value.every(isPosition)) {
    return false;
  }
  const firstPosition = value.at(0);
  const lastPosition = value.at(-1);
  return (
    firstPosition !== undefined &&
    lastPosition !== undefined &&
    positionsEqual(firstPosition, lastPosition)
  );
}

function isPolygonCoordinates(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(isLinearRing);
}

function isLocationGeometry(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (!isObject(value)) {
    return false;
  }
  if (value.type === 'Polygon') {
    return isPolygonCoordinates(value.coordinates);
  }
  if (value.type === 'MultiPolygon') {
    return (
      Array.isArray(value.coordinates) &&
      value.coordinates.length > 0 &&
      value.coordinates.every(isPolygonCoordinates)
    );
  }
  return false;
}

/** Parses the GTFS Schedule GeoJSON subset into one record per feature. */
export function parseLocationsGeoJSON(
  data: string,
  filename = 'locations.geojson',
): readonly ParsedLocationFeature[] {
  let document: unknown;
  try {
    document = JSON.parse(data);
  } catch {
    return throwInvalidLocationsGeoJSON(
      filename,
      'the document is not valid JSON',
    );
  }

  if (!isObject(document) || document.type !== 'FeatureCollection') {
    return throwInvalidLocationsGeoJSON(
      filename,
      'the root object must have type FeatureCollection',
    );
  }
  if (!Array.isArray(document.features)) {
    return throwInvalidLocationsGeoJSON(
      filename,
      'FeatureCollection.features must be an array',
    );
  }

  return document.features.map((feature, featureIndex) => {
    const featureNumber = featureIndex + 1;
    if (!isObject(feature) || feature.type !== 'Feature') {
      return throwInvalidLocationsGeoJSON(
        filename,
        'feature must have type Feature',
        {
          position: { kind: 'geojson', featureNumber },
        },
      );
    }
    if (typeof feature.id !== 'string' || feature.id.length === 0) {
      return throwInvalidLocationsGeoJSON(
        filename,
        'feature id must be a string',
        {
          position: { kind: 'geojson', featureNumber },
          field: 'id',
        },
      );
    }
    if (!isObject(feature.properties)) {
      return throwInvalidLocationsGeoJSON(
        filename,
        'feature properties must be an object',
        { position: { kind: 'geojson', featureNumber }, field: 'properties' },
      );
    }
    for (const property of ['stop_name', 'stop_desc'] as const) {
      const value = feature.properties[property];
      if (value !== undefined && value !== null && typeof value !== 'string') {
        return throwInvalidLocationsGeoJSON(
          filename,
          `${property} must be a string when present`,
          { position: { kind: 'geojson', featureNumber }, field: property },
        );
      }
    }
    if (!isLocationGeometry(feature.geometry)) {
      return throwInvalidLocationsGeoJSON(
        filename,
        'feature geometry must be a valid Polygon or MultiPolygon',
        { position: { kind: 'geojson', featureNumber }, field: 'geometry' },
      );
    }

    return Object.freeze({
      ...feature.properties,
      id: feature.id,
      geometry: feature.geometry,
    });
  });
}
