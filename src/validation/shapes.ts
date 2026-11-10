import type Database from 'better-sqlite3';
import {
  GtfsValidationNoticeCode,
  type GtfsValidationNotice,
} from '../diagnostics/errors.ts';
import type { GtfsPrimitiveParseResult } from '../values/parse.ts';
import { createValidationNotice } from './notice.ts';
import type {
  GtfsValidationSourceRecord,
  ValidateGtfsSourceOptions,
} from './types.ts';
import { isEmptyGtfsValue } from './values.ts';
import { formatGtfsSourcePosition } from '../diagnostics/position.ts';

const INHERIT_PICKUP = 1;
const INHERIT_DROP_OFF = 2;
const CONTINUOUS_STOPPING = 4;

function permitsContinuousStopping(value: number | undefined): boolean {
  return value === 0 || value === 2 || value === 3;
}

export function createGtfsShapeRequirements(database: Database.Database) {
  database.exec(`
    CREATE TABLE continuous_routes (route_id TEXT PRIMARY KEY, flags INTEGER) WITHOUT ROWID;
    CREATE TABLE continuous_trip_segments (
      trip_id TEXT PRIMARY KEY, last_sequence INTEGER, last_flags INTEGER, segment_flags INTEGER
    ) WITHOUT ROWID;
  `);
  const addRoute = database.prepare(
    'INSERT OR IGNORE INTO continuous_routes VALUES (?, ?)',
  );
  // Stop times need not arrive in sequence order. Keep the last stop separate:
  // its settings describe no onward segment, so only earlier stops contribute.
  const addStopTime = database.prepare(`
    INSERT INTO continuous_trip_segments VALUES (?, ?, ?, 0)
    ON CONFLICT (trip_id) DO UPDATE SET
      segment_flags = segment_flags | CASE
        WHEN excluded.last_sequence > last_sequence THEN last_flags
        WHEN excluded.last_sequence < last_sequence THEN excluded.last_flags
        ELSE 0 END,
      last_flags = CASE
        WHEN excluded.last_sequence > last_sequence THEN excluded.last_flags
        WHEN excluded.last_sequence = last_sequence THEN last_flags | excluded.last_flags
        ELSE last_flags END,
      last_sequence = max(last_sequence, excluded.last_sequence)
  `);
  const getRoute = database
    .prepare('SELECT flags FROM continuous_routes WHERE route_id = ?')
    .pluck();
  const getSegments = database
    .prepare(
      'SELECT segment_flags FROM continuous_trip_segments WHERE trip_id = ?',
    )
    .pluck();

  function requiresShape(row: GtfsValidationSourceRecord['row']): boolean {
    const routeFlags =
      (getRoute.get(row.route_id ?? '') as number | undefined) ?? 0;
    const segmentFlags = getSegments.get(row.trip_id ?? '') as
      number | undefined;
    // Known route defaults still establish the geometry requirement when no
    // stop-time rows are available to supply overrides.
    return segmentFlags === undefined
      ? routeFlags !== 0
      : (segmentFlags & (CONTINUOUS_STOPPING | routeFlags)) !== 0;
  }

  return {
    requiresShape,
    observe({
      filename,
      row,
      parsedValues,
    }: {
      readonly filename: string;
      readonly row: GtfsValidationSourceRecord['row'];
      readonly parsedValues: ReadonlyMap<string, GtfsPrimitiveParseResult>;
    }) {
      if (filename !== 'routes.txt' && filename !== 'stop_times.txt') {
        return;
      }
      const numberValue = (field: string) => {
        const parsed = parsedValues.get(field);
        return parsed?.valid && typeof parsed.value === 'number'
          ? parsed.value
          : undefined;
      };
      const pickup = permitsContinuousStopping(
        numberValue('continuous_pickup'),
      );
      const dropOff = permitsContinuousStopping(
        numberValue('continuous_drop_off'),
      );
      if (filename === 'routes.txt') {
        if (!isEmptyGtfsValue(row.route_id)) {
          addRoute.run(
            row.route_id,
            (pickup ? INHERIT_PICKUP : 0) | (dropOff ? INHERIT_DROP_OFF : 0),
          );
        }
        return;
      }
      const sequence = numberValue('stop_sequence');
      if (
        isEmptyGtfsValue(row.trip_id) ||
        sequence === undefined ||
        sequence < 0
      ) {
        return;
      }
      const flags =
        (pickup || dropOff ? CONTINUOUS_STOPPING : 0) |
        (isEmptyGtfsValue(row.continuous_pickup) ? INHERIT_PICKUP : 0) |
        (isEmptyGtfsValue(row.continuous_drop_off) ? INHERIT_DROP_OFF : 0);
      addStopTime.run(row.trip_id, sequence, flags);
    },
    *notices({
      options,
      trips,
      shapesPresent,
      state = { reportedMissingFile: false },
    }: {
      readonly options: ValidateGtfsSourceOptions;
      readonly trips: Iterable<GtfsValidationSourceRecord>;
      readonly shapesPresent: boolean;
      readonly state?: { reportedMissingFile: boolean };
    }): Generator<GtfsValidationNotice> {
      for (const { row, position } of trips) {
        if (!requiresShape(row)) {
          continue;
        }
        if (!shapesPresent && !state.reportedMissingFile) {
          state.reportedMissingFile = true;
          yield createValidationNotice(options, {
            code: GtfsValidationNoticeCode.REQUIRED_FILE_MISSING,
            severity: 'error',
            filename: 'shapes.txt',
            message:
              'Required GTFS file shapes.txt is missing for continuous pickup or drop-off',
            details: { tripId: row.trip_id, routeId: row.route_id },
          });
        }
        if (isEmptyGtfsValue(row.shape_id)) {
          yield createValidationNotice(options, {
            code: GtfsValidationNoticeCode.CONDITIONAL_PRESENCE,
            severity: 'error',
            filename: 'trips.txt',
            field: 'shape_id',
            position,
            message: `trips.txt ${formatGtfsSourcePosition(position)} requires "shape_id" for continuous pickup or drop-off`,
            details: { tripId: row.trip_id, routeId: row.route_id },
          });
        }
      }
    },
  };
}

export type GtfsShapeRequirements = ReturnType<
  typeof createGtfsShapeRequirements
>;
