import { describe, it, expect } from './test-utils.ts';
import { formatBoundingBoxCondition } from '../lib/sql-clauses.ts';

const EARTH_RADIUS_METERS = 6_371_000;

/** Metres per degree of latitude, constant under the spherical model. */
function metersPerDegreeLatitude(): number {
  return (Math.PI / 180) * EARTH_RADIUS_METERS;
}

/** Metres per degree of longitude, which shrinks towards the poles. */
function metersPerDegreeLongitude(latitude: number): number {
  return (
    (Math.PI / 180) * EARTH_RADIUS_METERS * Math.cos((latitude * Math.PI) / 180)
  );
}

function bounds(latitude: number, longitude: number, side: number) {
  const { params } = formatBoundingBoxCondition(latitude, longitude, side);
  const [minLatitude, maxLatitude, minLongitude, maxLongitude] =
    params as number[];
  return { minLatitude, maxLatitude, minLongitude, maxLongitude };
}

describe('formatBoundingBoxCondition()', () => {
  it('should produce a clause with four ordered placeholders', () => {
    const { clause, params } = formatBoundingBoxCondition(37.7, -122.4, 100);

    expect(clause).toBe(
      'stop_lat BETWEEN ? AND ? AND stop_lon BETWEEN ? AND ?',
    );
    expect(params).toHaveLength(4);
  });

  it('should centre the box on the given point', () => {
    const latitude = 37.709538;
    const longitude = -122.401586;
    const { minLatitude, maxLatitude, minLongitude, maxLongitude } = bounds(
      latitude,
      longitude,
      1000,
    );

    expect((minLatitude + maxLatitude) / 2).toBeCloseTo(latitude, 9);
    expect((minLongitude + maxLongitude) / 2).toBeCloseTo(longitude, 9);
    expect(minLatitude < maxLatitude).toBeTruthy();
    expect(minLongitude < maxLongitude).toBeTruthy();
  });

  it('should span the requested side length in metres at the equator', () => {
    const side = 1000;
    const { minLatitude, maxLatitude, minLongitude, maxLongitude } = bounds(
      0,
      0,
      side,
    );

    const heightMeters =
      (maxLatitude - minLatitude) * metersPerDegreeLatitude();
    const widthMeters =
      (maxLongitude - minLongitude) * metersPerDegreeLongitude(0);

    expect(heightMeters).toBeCloseTo(side, 6);
    expect(widthMeters).toBeCloseTo(side, 6);
  });

  it('should keep the box square in metres as latitude increases', () => {
    // The longitude delta divides by cos(latitude), so the degree width grows
    // towards the poles while the width in metres stays fixed.
    const side = 5000;

    for (const latitude of [0, 37.7, 51.5, 61.2, 69.6, 85]) {
      const { minLatitude, maxLatitude, minLongitude, maxLongitude } = bounds(
        latitude,
        0,
        side,
      );

      const heightMeters =
        (maxLatitude - minLatitude) * metersPerDegreeLatitude();
      const widthMeters =
        (maxLongitude - minLongitude) * metersPerDegreeLongitude(latitude);

      expect(heightMeters).toBeCloseTo(side, 6);
      expect(widthMeters).toBeCloseTo(side, 6);
    }
  });

  it('should widen the longitude span in degrees at higher latitudes', () => {
    const side = 5000;
    const atEquator = bounds(0, 0, side);
    const atTromso = bounds(69.6, 0, side);

    const equatorSpan = atEquator.maxLongitude - atEquator.minLongitude;
    const tromsoSpan = atTromso.maxLongitude - atTromso.minLongitude;

    expect(tromsoSpan).toBeGreaterThan(equatorSpan * 2);
    // Latitude span is unaffected by latitude.
    expect(atTromso.maxLatitude - atTromso.minLatitude).toBeCloseTo(
      atEquator.maxLatitude - atEquator.minLatitude,
      12,
    );
  });

  it('should scale linearly with the requested side length', () => {
    const small = bounds(37.7, -122.4, 100);
    const large = bounds(37.7, -122.4, 1000);

    const smallSpan = small.maxLatitude - small.minLatitude;
    const largeSpan = large.maxLatitude - large.minLatitude;

    expect(largeSpan / smallSpan).toBeCloseTo(10, 9);
  });

  it('should accept numeric strings', () => {
    const fromNumbers = formatBoundingBoxCondition(37.7, -122.4, 500);
    const fromStrings = formatBoundingBoxCondition('37.7', '-122.4', 500);

    expect(fromStrings.params).toEqual(fromNumbers.params);
  });

  it('should throw for out-of-range or non-numeric coordinates', () => {
    expect(() => formatBoundingBoxCondition(91, 0, 100)).toThrow(
      'Invalid latitude or longitude values',
    );
    expect(() => formatBoundingBoxCondition(-91, 0, 100)).toThrow(
      'Invalid latitude or longitude values',
    );
    expect(() => formatBoundingBoxCondition(0, 181, 100)).toThrow(
      'Invalid latitude or longitude values',
    );
    expect(() => formatBoundingBoxCondition(0, -181, 100)).toThrow(
      'Invalid latitude or longitude values',
    );
    expect(() => formatBoundingBoxCondition('abc', 0, 100)).toThrow(
      'Invalid latitude or longitude values',
    );
  });
});
