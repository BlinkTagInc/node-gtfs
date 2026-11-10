export interface GtfsCsvSourcePosition {
  readonly kind: 'csv';
  /** One-based data-record number, excluding the header; not a batch offset. */
  readonly recordNumber: number;
  /** One-based physical line where the record ends, including the header. */
  readonly csvLineNumber: number;
}

export interface GtfsGeoJSONSourcePosition {
  readonly kind: 'geojson';
  /** One-based index in the FeatureCollection's features array. */
  readonly featureNumber: number;
}

export type GtfsSourcePosition =
  | GtfsCsvSourcePosition
  | GtfsGeoJSONSourcePosition
  | GtfsRealtimeSourcePosition;

export interface GtfsRealtimeSourcePosition {
  readonly kind: 'realtime';
  /** One-based index in the FeedMessage's entity array. */
  readonly entityNumber: number;
}

export interface GtfsDiagnosticPosition {
  readonly position?: GtfsSourcePosition;
  /** Records in a failed write batch; not necessarily all invalid records. */
  readonly positions?: readonly GtfsSourcePosition[];
}

export function copyGtfsDiagnosticPositions(
  diagnostic: GtfsDiagnosticPosition,
): GtfsDiagnosticPosition {
  return {
    ...(diagnostic.position === undefined
      ? {}
      : { position: Object.freeze({ ...diagnostic.position }) }),
    ...(diagnostic.positions === undefined
      ? {}
      : {
          positions: Object.freeze(
            diagnostic.positions.map((position) =>
              Object.freeze({ ...position }),
            ),
          ),
        }),
  };
}

export function formatGtfsSourcePosition(position: GtfsSourcePosition): string {
  if (position.kind === 'geojson') {
    return `feature ${position.featureNumber}`;
  }
  if (position.kind === 'realtime') {
    return `Realtime entity ${position.entityNumber}`;
  }
  return `CSV record ${position.recordNumber} (ending at line ${position.csvLineNumber})`;
}
