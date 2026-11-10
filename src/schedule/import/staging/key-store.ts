import type Database from 'better-sqlite3';
import type { GtfsSourcePosition } from '../../../diagnostics/position.ts';

type KeyScope = 'primary' | 'storage';
const positionKinds = { csv: 0, geojson: 1, realtime: 2 } as const;

export interface GtfsValidationKeyTracker {
  register(
    key: string,
    position: GtfsSourcePosition,
  ): GtfsSourcePosition | undefined;
}

export function createGtfsValidationKeyStore(database: Database.Database) {
  database.exec(`CREATE TABLE record_keys (
    scope_id INTEGER, key TEXT, kind INTEGER, record_number INTEGER, csv_line INTEGER,
    PRIMARY KEY (scope_id, key)) WITHOUT ROWID`);
  const insert = database.prepare(
    'INSERT INTO record_keys VALUES (?, ?, ?, ?, ?) ON CONFLICT (scope_id, key) DO NOTHING',
  );
  const find = database.prepare(
    'SELECT kind, record_number, csv_line FROM record_keys WHERE scope_id = ? AND key = ?',
  );
  // Only file/scope metadata stays in memory. Full keys and their first positions
  // remain on disk; raw primary keys and normalized storage keys stay separate.
  const trackers = new Map<string, Map<KeyScope, GtfsValidationKeyTracker>>();
  let nextScopeId = 0;

  return (filename: string, scope: KeyScope): GtfsValidationKeyTracker => {
    let fileTrackers = trackers.get(filename);
    if (fileTrackers === undefined) {
      fileTrackers = new Map();
      trackers.set(filename, fileTrackers);
    }
    let tracker = fileTrackers.get(scope);
    if (tracker !== undefined) {
      return tracker;
    }
    const scopeId = ++nextScopeId;
    tracker = {
      register(key, position) {
        // The common unique case needs one database call and no serialization.
        const result = insert.run(
          scopeId,
          key,
          positionKinds[position.kind],
          position.kind === 'csv'
            ? position.recordNumber
            : position.kind === 'geojson'
              ? position.featureNumber
              : position.entityNumber,
          position.kind === 'csv' ? position.csvLineNumber : null,
        );
        if (result.changes !== 0) {
          return undefined;
        }
        const first = find.get(scopeId, key) as {
          kind: number;
          record_number: number;
          csv_line: number;
        };
        switch (first.kind) {
          case positionKinds.csv:
            return {
              kind: 'csv',
              recordNumber: first.record_number,
              csvLineNumber: first.csv_line,
            };
          case positionKinds.geojson:
            return { kind: 'geojson', featureNumber: first.record_number };
          case positionKinds.realtime:
            return { kind: 'realtime', entityNumber: first.record_number };
          default:
            throw new Error('Invalid staged duplicate-key position kind');
        }
      },
    };
    fileTrackers.set(scope, tracker);
    return tracker;
  };
}
