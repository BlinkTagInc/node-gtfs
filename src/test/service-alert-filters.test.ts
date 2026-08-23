import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';

import { createSqliteGtfsTables } from '../lib/sqlite-gtfs-writer.ts';
import { getServiceAlerts } from '../../dist/index.js';

test('getServiceAlerts routes trip selector filters to informed entities', () => {
  const db = new Database(':memory:');

  try {
    createSqliteGtfsTables(db);
    db.prepare(
      `INSERT INTO service_alerts (
        id, header_text, description_text, created_timestamp,
        expiration_timestamp
      ) VALUES (?, ?, ?, ?, ?)`,
    ).run('alert-1', 'Header', 'Description', 1, 2);
    db.prepare(
      `INSERT INTO service_alert_informed_entities (
        alert_id,
        trip_id,
        trip_route_id,
        trip_direction_id,
        trip_start_time,
        trip_start_date,
        trip_schedule_relationship,
        trip_modified_trip_modifications_id,
        trip_modified_trip_affected_trip_id,
        trip_modified_trip_start_time,
        trip_modified_trip_start_date,
        created_timestamp,
        expiration_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'alert-1',
      'trip-1',
      'route-1',
      1,
      '08:00:00',
      '20260823',
      'SCHEDULED',
      'modification-1',
      'trip-original',
      '07:45:00',
      '20260823',
      1,
      2,
    );

    const alerts = getServiceAlerts(
      {
        trip_route_id: 'route-1',
        trip_direction_id: 1,
        trip_start_time: '08:00:00',
        trip_start_date: '20260823',
        trip_schedule_relationship: 'SCHEDULED',
        trip_modified_trip_modifications_id: 'modification-1',
        trip_modified_trip_affected_trip_id: 'trip-original',
        trip_modified_trip_start_time: '07:45:00',
        trip_modified_trip_start_date: '20260823',
      },
      [],
      [],
      { db },
    );

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].id, 'alert-1');
    assert.equal(alerts[0].informed_entities.length, 1);
    assert.equal(alerts[0].informed_entities[0].trip_route_id, 'route-1');
  } finally {
    db.close();
  }
});
