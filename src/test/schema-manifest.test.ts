import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { hasIn, set } from 'lodash-es';

import {
  gtfsJoins,
  gtfsManifest,
  gtfsNamespaces,
  gtfsScheduleReferenceRevision,
  tables,
} from '../../dist/schema/index.js';

describe('GTFS schema manifest', () => {
  test('contains every plain table definition without a legacy projection', () => {
    const tableDefinitions = Object.values(tables);

    assert.equal(Object.keys(gtfsManifest).length, tableDefinitions.length);

    for (const table of tableDefinitions) {
      const tableName =
        table.file === null
          ? table.table
          : table.file.slice(0, table.file.lastIndexOf('.'));
      const manifest = gtfsManifest[tableName];

      assert.ok(manifest, `Missing manifest for ${tableName}`);
      assert.equal('filenameBase' in table, false);
      assert.equal('filenameExtension' in table, false);
      assert.equal('schema' in table, false);
      assert.deepEqual(Object.keys(manifest.fields), Object.keys(table.fields));
      assert.deepEqual(
        manifest.primaryKey,
        'primaryKey' in table ? table.primaryKey : [],
      );

      if (manifest.file === null) {
        assert.equal(manifest.table, tableName);
      } else {
        assert.equal(manifest.file, table.file);
      }
    }
  });

  test('declares the GTFS Schedule reference revision', () => {
    assert.equal(gtfsScheduleReferenceRevision, '2026-04-27');
    assert.equal(gtfsManifest.networks.presence, 'conditionallyForbidden');
    assert.equal(
      gtfsManifest.route_networks.presence,
      'conditionallyForbidden',
    );
  });

  test('retains every table namespace in the manifest', () => {
    for (const table of Object.values(tables)) {
      const tableName =
        table.file === null
          ? table.table
          : table.file.slice(0, table.file.lastIndexOf('.'));
      assert.equal(gtfsManifest[tableName].namespace, table.namespace);
    }
  });

  test('uses the canonical namespace and table order', () => {
    const namespaceOrder = new Map(
      gtfsNamespaces.map((namespace, index) => [namespace, index]),
    );
    const manifestEntries = Object.entries(gtfsManifest);
    const expectedEntries = [...manifestEntries].sort(
      ([leftName, left], [rightName, right]) => {
        const namespaceDifference =
          namespaceOrder.get(left.namespace)! -
          namespaceOrder.get(right.namespace)!;
        if (namespaceDifference !== 0) return namespaceDifference;
        return leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
      },
    );

    assert.deepEqual(manifestEntries, expectedEntries);
  });

  test('expresses structural and semantic frequency metadata separately', () => {
    const frequencies = gtfsManifest.frequencies;

    assert.equal(frequencies.presence, 'optional');
    assert.deepEqual(frequencies.primaryKey, ['trip_id', 'start_time']);
    assert.deepEqual(frequencies.fields.trip_id.references, [
      { file: 'trips.txt', field: 'trip_id' },
    ]);
    assert.equal(frequencies.fields.headway_secs.minimum, 1);
    assert.equal(frequencies.fields.exact_times.kind, 'integer');
    assert.equal(frequencies.fields.exact_times.minimum, 0);
    assert.equal(frequencies.fields.exact_times.maximum, 1);
    assert.deepEqual(frequencies.constraints, [
      {
        kind: 'range',
        startField: 'start_time',
        endField: 'end_time',
        allowEqual: false,
      },
    ]);
    assert.equal(frequencies.storage.indexes, undefined);
    assert.equal('index' in frequencies.fields.trip_id, false);
    assert.equal(frequencies.fields.trip_id.applyFeedPrefix, true);
    assert.equal('prefixOnMerge' in frequencies.fields.trip_id, false);
    assert.equal('index' in tables.frequencies.fields.trip_id, false);
    assert.deepEqual(gtfsJoins.frequencies, [
      {
        field: 'trip_id',
        targetTable: 'trips',
        targetField: 'trip_id',
      },
    ]);
  });

  test('distinguishes queryable joins from fields inside structured files', () => {
    assert.deepEqual(gtfsManifest.stop_times.fields.location_id.references, [
      { file: 'locations.geojson', field: 'id' },
    ]);
    assert.equal(
      gtfsJoins.stop_times.some((join) => join.field === 'location_id'),
      false,
    );
  });

  test('includes both official Flex pickup and drop-off window fields', () => {
    const stopTimes = gtfsManifest.stop_times;

    assert.equal(stopTimes.fields.start_pickup_drop_off_window.kind, 'time');
    assert.equal(stopTimes.fields.end_pickup_drop_off_window.kind, 'time');
    assert.equal(
      stopTimes.fields.start_pickup_drop_off_window.presence,
      'conditionallyRequired',
    );
    assert.equal(
      stopTimes.fields.end_pickup_drop_off_window.presence,
      'conditionallyRequired',
    );
  });

  test('projects GTFS-Realtime file references into schedule joins', () => {
    assert.deepEqual(gtfsManifest.trip_updates.fields.trip_id.references, [
      { file: 'trips.txt', field: 'trip_id' },
    ]);
    assert.deepEqual(gtfsJoins.trip_updates, [
      {
        field: 'trip_id',
        targetTable: 'trips',
        targetField: 'trip_id',
      },
      {
        field: 'route_id',
        targetTable: 'routes',
        targetField: 'route_id',
      },
    ]);
  });

  test('maps the supported GTFS-Realtime protobuf fields without inventing defaults', () => {
    const vehiclePosition = gtfsManifest.vehicle_positions;
    const tripUpdate = gtfsManifest.trip_updates;
    const stopTimeUpdate = gtfsManifest.stop_time_updates;
    const alert = gtfsManifest.service_alerts;

    assert.equal(
      vehiclePosition.fields.current_status.sourcePath,
      'vehicle.currentStatus',
    );
    assert.equal(vehiclePosition.fields.stop_id.sourcePath, 'vehicle.stopId');
    assert.equal(
      vehiclePosition.fields.route_id.sourcePath,
      'vehicle.trip.routeId',
    );
    assert.equal(
      vehiclePosition.fields.direction_id.sourcePath,
      'vehicle.trip.directionId',
    );
    assert.equal(vehiclePosition.fields.multi_carriage_details.kind, 'json');
    assert.equal(
      tripUpdate.fields.trip_properties_shape_id.sourcePath,
      'tripUpdate.tripProperties.shapeId',
    );
    assert.equal(
      stopTimeUpdate.fields.arrival_uncertainty.sourcePath,
      'arrival.uncertainty',
    );
    assert.equal(
      stopTimeUpdate.fields.assigned_stop_id.sourcePath,
      'stopTimeProperties.assignedStopId',
    );
    assert.equal(
      alert.fields.communication_period.sourcePath,
      'alert.communicationPeriod',
    );
    assert.equal(alert.fields.header_text.defaultValue, undefined);
    assert.equal(alert.fields.description_text.defaultValue, undefined);
  });

  test('uses source paths exposed by the official GTFS-Realtime bindings', () => {
    const realtime = GtfsRealtimeBindings.transit_realtime;
    const sourceRoots: Record<
      string,
      {
        root: { fromObject(value: Record<string, unknown>): object };
        parent?: { fromObject(value: Record<string, unknown>): object };
      }
    > = {
      service_alerts: { root: realtime.FeedEntity },
      trip_updates: { root: realtime.FeedEntity },
      vehicle_positions: { root: realtime.FeedEntity },
      service_alert_informed_entities: {
        root: realtime.EntitySelector,
        parent: realtime.FeedEntity,
      },
      stop_time_updates: {
        root: realtime.TripUpdate.StopTimeUpdate,
        parent: realtime.FeedEntity,
      },
    };

    for (const [tableName, table] of Object.entries(gtfsManifest)) {
      if (table.namespace !== 'gtfs-realtime') continue;

      const roots = sourceRoots[tableName];
      assert.ok(roots, `Missing protobuf source root for ${tableName}`);

      for (const [fieldName, field] of Object.entries(table.fields)) {
        if (field.sourcePath === undefined) continue;

        const usesParent = field.sourcePath.startsWith('parent.');
        const sourcePath = usesParent
          ? field.sourcePath.slice('parent.'.length)
          : field.sourcePath;
        const sourceRoot = usesParent ? roots.parent : roots.root;

        assert.ok(
          sourceRoot,
          `Missing parent protobuf source root for ${tableName}.${fieldName}`,
        );

        const sourceValue = {};
        set(sourceValue, sourcePath, null);
        const message = sourceRoot.fromObject(sourceValue);

        assert.equal(
          hasIn(message, sourcePath),
          true,
          `Invalid protobuf source path for ${tableName}.${fieldName}: ${field.sourcePath}`,
        );
      }
    }
  });

  test('uses open enumerations only for GTFS-Realtime fields', () => {
    let enumerationCount = 0;

    for (const table of Object.values(gtfsManifest)) {
      for (const field of Object.values(table.fields)) {
        if (field.kind === 'enumeration') {
          enumerationCount += 1;
          assert.equal(table.namespace, 'gtfs-realtime');
          assert.notEqual(field.closed, true);
        }
      }
    }

    assert.ok(enumerationCount > 0);
  });

  test('projects GTFS-to-HTML, TODS, and TIDES references into joins', () => {
    const referenceCountByNamespace = Object.values(gtfsManifest).reduce<
      Record<string, number>
    >((counts, table) => {
      counts[table.namespace] =
        (counts[table.namespace] ?? 0) +
        Object.values(table.fields).reduce(
          (count, field) => count + (field.references?.length ?? 0),
          0,
        );
      return counts;
    }, {});

    const joinCountByNamespace = Object.entries(gtfsManifest).reduce<
      Record<string, number>
    >((counts, [tableName, table]) => {
      counts[table.namespace] =
        (counts[table.namespace] ?? 0) + gtfsJoins[tableName].length;
      return counts;
    }, {});

    assert.equal(referenceCountByNamespace['gtfs-to-html'], 13);
    assert.equal(referenceCountByNamespace.tods, 18);
    assert.equal(referenceCountByNamespace.tides, 37);
    assert.equal(joinCountByNamespace['gtfs-to-html'], 13);
    assert.equal(joinCountByNamespace.tods, 18);
    assert.equal(joinCountByNamespace.tides, 37);

    assert.deepEqual(
      gtfsManifest.timetable_notes_references.fields.note_id.references,
      [{ file: 'timetable_notes.txt', field: 'note_id' }],
    );
    assert.deepEqual(gtfsManifest.deadheads.fields.service_id.references, [
      { file: 'calendar.txt', field: 'service_id' },
      { file: 'calendar_dates.txt', field: 'service_id' },
    ]);
    assert.deepEqual(
      gtfsManifest.run_event.fields.event_from_location_id.references,
      [
        { file: 'stops.txt', field: 'stop_id' },
        { file: 'ops_locations.txt', field: 'ops_location_id' },
      ],
    );
    assert.deepEqual(
      gtfsManifest.fare_transactions.fields.trip_id_scheduled.references,
      [{ file: 'trips_performed.csv', field: 'trip_id_scheduled' }],
    );
    assert.equal(
      gtfsManifest.fare_transactions.fields.fare_media_id.references,
      undefined,
    );
    assert.equal(
      gtfsManifest.timetable_stop_order.fields.stop_sequence.references,
      undefined,
    );
  });

  test('keeps semantic rules directly on the public definition', () => {
    const headway = tables.frequencies.fields.headway_secs;
    const exactTimes = tables.frequencies.fields.exact_times;

    assert.equal(headway.minimum, 1);
    assert.equal(exactTimes.minimum, 0);
    assert.equal(exactTimes.maximum, 1);
    assert.equal('schema' in tables.frequencies, false);
  });

  test('declares no index that a primary key or composite already covers', () => {
    const redundant: string[] = [];

    for (const [tableName, table] of Object.entries(gtfsManifest)) {
      const primaryKey = table.primaryKey ?? [];
      const indexes = (table.storage?.indexes ?? []).map((index) =>
        typeof index === 'string' ? [index] : index,
      );

      for (const columns of indexes) {
        const coveredByPrimaryKey = columns.every(
          (column, position) => primaryKey[position] === column,
        );
        const coveredByComposite = indexes.some(
          (other) =>
            other.length > columns.length &&
            columns.every((column, position) => other[position] === column),
        );

        if (coveredByPrimaryKey || coveredByComposite) {
          redundant.push(`${tableName} (${columns.join(', ')})`);
        }
      }
    }

    assert.deepEqual(redundant, []);
  });

  test('uses explicit names for normalization and source metadata', () => {
    assert.equal(tables.transfers.fields.transfer_type.defaultValue, 0);
    assert.equal(
      tables.tripUpdates.fields.trip_start_time.sourcePath,
      'tripUpdate.trip.startTime',
    );
    assert.equal('default' in tables.transfers.fields.transfer_type, false);
    assert.equal('source' in tables.tripUpdates.fields.trip_start_time, false);
  });
});
