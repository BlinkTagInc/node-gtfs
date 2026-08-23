import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

import { compiledTableRegistry } from '../schema/table-registry.ts';
import { createSqliteGtfsRealtimeWriter } from '../lib/sqlite-gtfs-realtime-writer.ts';
import { createSqliteGtfsTables } from '../lib/sqlite-gtfs-writer.ts';
import { closeDb, openDb, updateGtfsRealtime } from '../../dist/index.js';

function createLegacyVehiclePositionsTable(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS vehicle_positions;
    CREATE TABLE vehicle_positions (
      id TEXT NOT NULL,
      bearing REAL,
      latitude REAL,
      longitude REAL,
      speed REAL,
      current_stop_sequence INTEGER,
      trip_id TEXT,
      trip_start_date TEXT,
      trip_start_time TEXT,
      congestion_level TEXT,
      occupancy_status TEXT,
      occupancy_percentage INTEGER,
      vehicle_stop_status TEXT,
      vehicle_id TEXT,
      vehicle_label TEXT,
      vehicle_license_plate TEXT,
      vehicle_wheelchair_accessible TEXT,
      timestamp TEXT,
      created_timestamp INTEGER NOT NULL,
      expiration_timestamp INTEGER NOT NULL,
      PRIMARY KEY (id)
    );
  `);
}

test('realtime writes migrate an existing SQLite schema', async () => {
  const db = new Database(':memory:');

  try {
    createLegacyVehiclePositionsTable(db);
    db.exec(`
      INSERT INTO vehicle_positions (
        id,
        vehicle_stop_status,
        created_timestamp,
        expiration_timestamp
      ) VALUES ('legacy', 'IN_TRANSIT_TO', 1, 2);
    `);

    const writer = createSqliteGtfsRealtimeWriter(db);
    const table = compiledTableRegistry.vehiclePositions;
    const result = await writer.writeEntities([
      {
        mutations: [
          {
            operation: 'replace',
            table,
            row: {
              id: 'current',
              route_id: 'route-1',
              direction_id: 1,
              stop_id: 'stop-1',
              vehicle_stop_status: 'STOPPED_AT',
              current_status: 'STOPPED_AT',
              created_timestamp: 3,
              expiration_timestamp: 4,
            },
          },
        ],
      },
    ]);

    assert.equal(result.recordCount, 1);
    assert.deepEqual(result.errors, []);

    const columns = db
      .prepare('PRAGMA table_info("vehicle_positions")')
      .all() as Array<{ name: string; type: string }>;
    assert.deepEqual(
      table.columns
        .map((column) => column.name)
        .filter((name) => !columns.some((column) => column.name === name)),
      [],
    );
    assert.equal(
      columns.find((column) => column.name === 'timestamp')?.type,
      'INTEGER',
    );
    assert.deepEqual(
      db
        .prepare(
          `SELECT id, route_id, stop_id, current_status, vehicle_stop_status
           FROM vehicle_positions ORDER BY id`,
        )
        .all(),
      [
        {
          id: 'current',
          route_id: 'route-1',
          stop_id: 'stop-1',
          current_status: 'STOPPED_AT',
          vehicle_stop_status: 'STOPPED_AT',
        },
        {
          id: 'legacy',
          route_id: null,
          stop_id: null,
          current_status: null,
          vehicle_stop_status: 'IN_TRANSIT_TO',
        },
      ],
    );

    createSqliteGtfsRealtimeWriter(db);
    assert.equal(
      db.prepare('SELECT COUNT(*) FROM vehicle_positions').pluck().get(),
      2,
    );
  } finally {
    db.close();
  }
});

test('updateGtfsRealtime writes to a database with a legacy realtime table', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-rt-migration-'));
  const sqlitePath = path.join(directory, 'gtfs.sqlite');
  const setupDb = new Database(sqlitePath);
  const originalFetch = globalThis.fetch;

  try {
    createSqliteGtfsTables(setupDb);
    createLegacyVehiclePositionsTable(setupDb);
    setupDb.close();

    const message =
      GtfsRealtimeBindings.transit_realtime.FeedMessage.fromObject({
        header: { gtfsRealtimeVersion: '2.0' },
        entity: [
          {
            id: 'vehicle-position',
            vehicle: {
              trip: {
                routeId: 'route-1',
                directionId: 1,
              },
              stopId: 'stop-1',
              currentStatus: 'STOPPED_AT',
            },
          },
        ],
      });
    const payload = Buffer.from(
      GtfsRealtimeBindings.transit_realtime.FeedMessage.encode(
        message,
      ).finish(),
    );
    globalThis.fetch = (async () =>
      new Response(payload, { status: 200 })) as typeof fetch;

    const config = {
      agencies: [
        {
          realtimeVehiclePositions: {
            url: 'https://example.test/vehicle-positions',
          },
        },
      ],
      sqlitePath,
      logLevel: 'silent' as const,
    };

    await updateGtfsRealtime(config);

    const db = openDb(config);
    assert.deepEqual(
      db
        .prepare(
          `SELECT route_id, direction_id, stop_id, current_status
           FROM vehicle_positions WHERE id = ?`,
        )
        .get('vehicle-position'),
      {
        route_id: 'route-1',
        direction_id: 1,
        stop_id: 'stop-1',
        current_status: 'STOPPED_AT',
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (setupDb.open) setupDb.close();
    const db = openDb({ sqlitePath });
    closeDb(db);
    await rm(directory, { recursive: true, force: true });
  }
});
