import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { hasIn, set } from 'lodash-es';

import {
  gtfsJoins,
  gtfsManifest,
  gtfsExtensions,
  gtfsSpecifications,
  gtfsScheduleReferenceRevision,
  tables,
} from '../../src/schema/index.ts';

describe('GTFS schema manifest', () => {
  test('freezes exported schema definitions and manifest metadata deeply', () => {
    assert.equal(Object.isFrozen(tables.routes), true);
    assert.equal(Object.isFrozen(tables.routes.fields), true);
    assert.equal(Object.isFrozen(tables.routes.primaryKey), true);
    assert.equal(Object.isFrozen(gtfsManifest), true);
    assert.equal(Object.isFrozen(gtfsManifest.routes), true);
    assert.equal(Object.isFrozen(gtfsManifest.routes.inputFields), true);
    assert.equal(Object.isFrozen(gtfsManifest.routes.fields), true);
    assert.equal(Object.isFrozen(gtfsJoins), true);
    assert.equal(Object.isFrozen(gtfsJoins.routes), true);
    assert.equal(Object.isFrozen(gtfsJoins.routes[0]), true);
  });

  test('matches every table definition and its source-scoped storage key', () => {
    const tableDefinitions = Object.values(tables);

    assert.equal(Object.keys(gtfsManifest).length, tableDefinitions.length);

    for (const table of tableDefinitions) {
      const tableName = table.tableName;
      const manifest = gtfsManifest[tableName];

      assert.ok(manifest, `Missing manifest for ${tableName}`);
      assert.deepEqual(Object.keys(manifest.fields), Object.keys(table.fields));
      assert.deepEqual(manifest.primaryKey, table.primaryKey);
      assert.deepEqual(manifest.storageKey, table.storageKey);
      assert.equal(manifest.keyStrategy, table.keyStrategy);
      if (manifest.storageKey === null) {
        assert.equal(manifest.keyStrategy, 'none');
      } else {
        assert.equal(manifest.storageKey[0], 'source_id');
        assert.ok(
          manifest.primaryKey.every((field) =>
            manifest.storageKey?.includes(field),
          ),
        );
        assert.notEqual(manifest.keyStrategy, 'none');
      }

      if (manifest.filename === null) {
        assert.equal(manifest.tableName, tableName);
      } else {
        assert.equal(manifest.filename, table.filename);
        assert.equal(
          manifest.tableName,
          manifest.specification === 'tods' &&
            manifest.filename === 'vehicles.txt'
            ? 'tods_vehicles'
            : manifest.filename.replace(/\.(?:txt|csv|geojson)$/u, ''),
        );
      }
    }
  });

  test('declares the GTFS Schedule reference revision', () => {
    assert.equal(gtfsScheduleReferenceRevision, '2026-09-16');
    assert.equal(gtfsManifest.shapes.presence, 'conditionally-required');
    assert.equal(gtfsManifest.networks.presence, 'conditionally-forbidden');
    assert.equal(
      gtfsManifest.route_networks.presence,
      'conditionally-forbidden',
    );
  });

  test('retains every table specification in the manifest', () => {
    for (const table of Object.values(tables)) {
      assert.equal(
        gtfsManifest[table.tableName].specification,
        table.specification,
      );
    }
  });

  test('uses the canonical specification and table order', () => {
    assert.deepEqual(gtfsSpecifications, ['gtfs-schedule', ...gtfsExtensions]);
    const specificationOrder = new Map(
      gtfsSpecifications.map((group, index) => [group, index]),
    );
    const manifestEntries = Object.entries(gtfsManifest);
    const expectedEntries = [...manifestEntries].sort(
      ([leftName, left], [rightName, right]) => {
        const specificationDifference =
          specificationOrder.get(left.specification)! -
          specificationOrder.get(right.specification)!;
        if (specificationDifference !== 0) {
          return specificationDifference;
        }
        return leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
      },
    );

    assert.deepEqual(manifestEntries, expectedEntries);
  });

  test('expresses structural and semantic frequency metadata separately', () => {
    const frequencies = gtfsManifest.frequencies;

    assert.equal(frequencies.presence, 'optional');
    assert.deepEqual(frequencies.primaryKey, ['trip_id', 'start_time']);
    assert.deepEqual(frequencies.storageKey, [
      'source_id',
      'trip_id',
      'start_time',
    ]);
    assert.deepEqual(frequencies.fields.trip_id!.references, [
      { targetFilename: 'trips.txt', targetField: 'trip_id' },
    ]);
    assert.equal(frequencies.fields.headway_secs!.minimum, 1);
    assert.equal(frequencies.fields.exact_times!.kind, 'integer');
    assert.equal(frequencies.fields.exact_times!.minimum, 0);
    assert.equal(frequencies.fields.exact_times!.maximum, 1);
    assert.deepEqual(frequencies.constraints, [
      {
        kind: 'range',
        startField: 'start_time',
        endField: 'end_time',
        allowEqual: false,
      },
    ]);
    assert.deepEqual(frequencies.indexes, []);
    assert.deepEqual(gtfsJoins.frequencies, [
      {
        sourceField: 'trip_id',
        targetTableName: 'trips',
        targetField: 'trip_id',
      },
    ]);
  });

  test('exposes structured location features as queryable joins', () => {
    assert.deepEqual(gtfsManifest.stop_times.fields.location_id!.references, [
      { targetFilename: 'locations.geojson', targetField: 'id' },
    ]);
    assert.deepEqual(
      gtfsJoins.stop_times.find((join) => join.sourceField === 'location_id'),
      {
        sourceField: 'location_id',
        targetTableName: 'locations',
        targetField: 'id',
      },
    );
    assert.deepEqual(gtfsManifest.locations.primaryKey, ['id']);
    assert.deepEqual(gtfsManifest.locations.storageKey, ['source_id', 'id']);
    assert.equal('applyFeedPrefix' in gtfsManifest.locations.fields.id!, false);
    assert.equal(gtfsManifest.locations.fields.geometry!.kind, 'json');
  });

  test('includes both official Flex pickup and drop-off window fields', () => {
    const stopTimes = gtfsManifest.stop_times;

    assert.equal(stopTimes.fields.start_pickup_drop_off_window!.kind, 'time');
    assert.equal(stopTimes.fields.end_pickup_drop_off_window!.kind, 'time');
    assert.equal(
      stopTimes.fields.start_pickup_drop_off_window!.presence,
      'conditionally-required',
    );
    assert.equal(
      stopTimes.fields.end_pickup_drop_off_window!.presence,
      'conditionally-required',
    );
  });

  test('projects GTFS-Realtime file references into schedule joins', () => {
    assert.deepEqual(gtfsManifest.trip_updates.fields.trip_id!.references, [
      { targetFilename: 'trips.txt', targetField: 'trip_id' },
    ]);
    assert.deepEqual(gtfsJoins.trip_updates, [
      {
        sourceField: 'trip_id',
        targetTableName: 'trips',
        targetField: 'trip_id',
      },
      {
        sourceField: 'route_id',
        targetTableName: 'routes',
        targetField: 'route_id',
      },
    ]);
  });

  test('maps the supported GTFS-Realtime protobuf fields without inventing defaults', () => {
    const vehiclePosition = gtfsManifest.vehicle_positions;
    const tripUpdate = gtfsManifest.trip_updates;
    const stopTimeUpdate = gtfsManifest.trip_update_stop_time_updates;
    const alert = gtfsManifest.alerts;
    const alertPeriod = gtfsManifest.alert_time_ranges;

    assert.equal(
      vehiclePosition.fields.current_status!.sourcePath,
      'vehicle.currentStatus',
    );
    assert.equal(vehiclePosition.fields.stop_id!.sourcePath, 'vehicle.stopId');
    assert.equal(
      vehiclePosition.fields.route_id!.sourcePath,
      'vehicle.trip.routeId',
    );
    assert.equal(
      vehiclePosition.fields.direction_id!.sourcePath,
      'vehicle.trip.directionId',
    );
    assert.equal(vehiclePosition.fields.multi_carriage_details!.kind, 'json');
    assert.equal(
      tripUpdate.fields.trip_properties_shape_id!.sourcePath,
      'tripUpdate.tripProperties.shapeId',
    );
    assert.equal(
      stopTimeUpdate.fields.arrival_uncertainty!.sourcePath,
      'arrival.uncertainty',
    );
    assert.equal(
      stopTimeUpdate.fields.assigned_stop_id!.sourcePath,
      'stopTimeProperties.assignedStopId',
    );
    assert.equal(
      alert.fields.communication_period!.sourcePath,
      'alert.communicationPeriod',
    );
    assert.equal(alert.fields.start_time, undefined);
    assert.equal(alert.fields.end_time, undefined);
    assert.equal(alertPeriod.fields.start_unix_seconds!.sourcePath, 'start');
    assert.equal(alertPeriod.fields.end_unix_seconds!.sourcePath, 'end');
    assert.equal(alert.fields.header_text!.defaultValue, undefined);
    assert.equal(alert.fields.description_text!.defaultValue, undefined);
  });

  test('separates Realtime persistence, current entities, and ordinal children', () => {
    assert.deepEqual(gtfsManifest.realtime_feeds.storageKey, [
      'source_id',
      'realtime_feed_id',
    ]);
    assert.deepEqual(gtfsManifest.realtime_snapshots.storageKey, [
      'source_id',
      'realtime_feed_id',
      'snapshot_id',
    ]);
    assert.deepEqual(gtfsManifest.realtime_feed_entities.storageKey, [
      'source_id',
      'realtime_feed_id',
      'snapshot_id',
      'entity_ordinal',
    ]);
    assert.deepEqual(gtfsManifest.alert_entity_selectors.storageKey, [
      'source_id',
      'realtime_feed_id',
      'alert_id',
      'selector_ordinal',
    ]);
    assert.deepEqual(gtfsManifest.alert_time_ranges.storageKey, [
      'source_id',
      'realtime_feed_id',
      'alert_id',
      'range_kind',
      'range_ordinal',
    ]);
    assert.deepEqual(gtfsManifest.trip_update_stop_time_updates.storageKey, [
      'source_id',
      'realtime_feed_id',
      'trip_update_id',
      'stop_time_update_ordinal',
    ]);

    assert.equal(
      gtfsManifest.realtime_snapshots.fields.raw_payload_encoding!.defaultValue,
      undefined,
    );
  });

  test('declares Realtime entity fields and Unix-second constraints', () => {
    for (const [tableName, table] of Object.entries(gtfsManifest)) {
      if (table.specification !== 'gtfs-realtime') {
        continue;
      }

      for (const [fieldName, field] of Object.entries(table.fields)) {
        if (!fieldName.endsWith('_unix_seconds')) {
          continue;
        }
        assert.equal(field.kind, 'integer', `${tableName}.${fieldName}`);
        // StopTimeEvent times retain the protobuf's signed int64 semantics.
        const isStopTimeEvent =
          tableName === 'trip_update_stop_time_updates' &&
          /^(arrival|departure)(_scheduled)?_unix_seconds$/.test(fieldName);
        assert.equal(
          field.minimum,
          isStopTimeEvent ? undefined : 0,
          `${tableName}.${fieldName}`,
        );
      }
    }

    for (const tableName of [
      'alerts',
      'trip_updates',
      'vehicle_positions',
      'realtime_shapes',
      'realtime_stops',
      'trip_modifications',
    ] as const) {
      assert.equal('entity_id' in gtfsManifest[tableName].fields, true);
    }

    assert.equal(
      gtfsManifest.trip_updates.fields.trip_start_date!.sourcePath,
      'tripUpdate.trip.startDate',
    );
    assert.equal(
      gtfsManifest.vehicle_positions.fields.current_status!.sourcePath,
      'vehicle.currentStatus',
    );
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
      alert_entity_selectors: {
        root: realtime.EntitySelector,
        parent: realtime.FeedEntity,
      },
      alert_time_ranges: {
        root: realtime.TimeRange,
        parent: realtime.FeedEntity,
      },
      realtime_feed_entities: { root: realtime.FeedEntity },
      realtime_feeds: { root: realtime.FeedMessage },
      realtime_shapes: { root: realtime.FeedEntity },
      realtime_snapshots: { root: realtime.FeedMessage },
      realtime_stops: { root: realtime.FeedEntity },
      alerts: { root: realtime.FeedEntity },
      trip_modifications: { root: realtime.FeedEntity },
      trip_updates: { root: realtime.FeedEntity },
      vehicle_positions: { root: realtime.FeedEntity },
      trip_update_stop_time_updates: {
        root: realtime.TripUpdate.StopTimeUpdate,
        parent: realtime.FeedEntity,
      },
    };

    for (const [tableName, table] of Object.entries(gtfsManifest)) {
      if (table.specification !== 'gtfs-realtime') {
        continue;
      }

      const roots = sourceRoots[tableName];
      assert.ok(roots, `Missing protobuf source root for ${tableName}`);

      for (const [fieldName, field] of Object.entries(table.fields)) {
        if (field.sourcePath === undefined) {
          continue;
        }

        const usesParent = field.sourcePath.startsWith('parent.');
        const sourcePath = usesParent
          ? field.sourcePath.slice('parent.'.length)
          : field.sourcePath;
        const sourceRoot:
          | {
              fromObject(value: Record<string, unknown>): object;
            }
          | undefined = usesParent ? roots.parent : roots.root;

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
          if (field.closed !== true) {
            assert.equal(table.specification, 'gtfs-realtime');
          }
          if (field.sourcePath !== undefined) {
            assert.notEqual(field.closed, true);
          }
        }
      }
    }

    assert.ok(enumerationCount > 0);
  });

  test('projects GTFS-to-HTML, TODS, and TIDES references into joins', () => {
    const referenceCountByExtension = Object.values(gtfsManifest).reduce<
      Record<string, number>
    >((counts, table) => {
      counts[table.specification] =
        (counts[table.specification] ?? 0) +
        Object.values(table.fields).reduce(
          (count, field) => count + (field.references?.length ?? 0),
          0,
        );
      return counts;
    }, {});

    const joinCountByExtension = Object.entries(gtfsManifest).reduce<
      Record<string, number>
    >((counts, [tableName, table]) => {
      counts[table.specification] =
        (counts[table.specification] ?? 0) +
        gtfsJoins[tableName as keyof typeof gtfsJoins].length;
      return counts;
    }, {});

    assert.equal(referenceCountByExtension['gtfs-to-html'], 13);
    assert.equal(referenceCountByExtension.tods, 40);
    assert.equal(referenceCountByExtension['tods-v1'], 18);
    assert.equal(referenceCountByExtension.tides, 37);
    assert.equal(joinCountByExtension['gtfs-to-html'], 13);
    assert.equal(joinCountByExtension.tods, 40);
    assert.equal(joinCountByExtension['tods-v1'], 18);
    assert.equal(joinCountByExtension.tides, 37);

    assert.deepEqual(
      gtfsManifest.timetable_notes_references.fields.note_id!.references,
      [
        {
          targetFilename: 'timetable_notes.txt',
          targetField: 'note_id',
        },
      ],
    );
    assert.deepEqual(gtfsManifest.deadheads.fields.service_id!.references, [
      { targetFilename: 'calendar.txt', targetField: 'service_id' },
      { targetFilename: 'calendar_dates.txt', targetField: 'service_id' },
    ]);
    assert.deepEqual(
      gtfsManifest.run_event.fields.event_from_location_id!.references,
      [
        { targetFilename: 'stops.txt', targetField: 'stop_id' },
        {
          targetFilename: 'ops_locations.txt',
          targetField: 'ops_location_id',
        },
      ],
    );
    assert.deepEqual(
      gtfsManifest.fare_transactions.fields.trip_id_scheduled!.references,
      [
        {
          targetFilename: 'trips_performed.csv',
          targetField: 'trip_id_scheduled',
        },
      ],
    );
    assert.equal(
      gtfsManifest.fare_transactions.fields.fare_media_id!.references,
      undefined,
    );
    assert.equal(
      gtfsManifest.timetable_stop_order.fields.stop_sequence!.references,
      undefined,
    );
  });

  test('keeps semantic rules directly on the public definition', () => {
    const headway = tables.frequencies.fields.headway_secs;
    const exactTimes = tables.frequencies.fields.exact_times;

    assert.equal(headway.minimum, 1);
    assert.equal(exactTimes.minimum, 0);
    assert.equal(exactTimes.maximum, 1);
  });

  test('declares no index that a storage key or composite already covers', () => {
    const redundant: string[] = [];

    for (const [tableName, table] of Object.entries(gtfsManifest)) {
      const storageKey = table.storageKey;
      const indexes = table.indexes.map((index) =>
        typeof index === 'string' ? [index] : index,
      );

      for (const columns of indexes) {
        const coveredByStorageKey =
          storageKey !== null &&
          columns.every((column, position) => storageKey[position] === column);
        const coveredByComposite = indexes.some(
          (other) =>
            other.length > columns.length &&
            columns.every((column, position) => other[position] === column),
        );

        if (coveredByStorageKey || coveredByComposite) {
          redundant.push(`${tableName} (${columns.join(', ')})`);
        }
      }
    }

    assert.deepEqual(redundant, []);
  });

  test('separates input, derived, selected, and key metadata', () => {
    const stopTimes = gtfsManifest.stop_times;

    assert.deepEqual(stopTimes.inputFields, Object.keys(stopTimes.fields));
    assert.deepEqual(stopTimes.primaryKey, ['trip_id', 'stop_sequence']);
    assert.deepEqual(stopTimes.storageKey, [
      'source_id',
      'trip_id',
      'stop_sequence',
    ]);
    assert.equal(stopTimes.keyStrategy, 'columns');
    assert.deepEqual(stopTimes.derivedFields.arrival_service_day_seconds, {
      kind: 'integer',
      sourceField: 'arrival_time',
      expression: 'service-day-seconds',
      selectedByDefault: false,
    });
    assert.equal(
      stopTimes.defaultSelectedFields.includes('arrival_service_day_seconds'),
      false,
    );
    assert.equal(stopTimes.defaultSelectedFields[0], 'source_id');
  });

  test('declares exact money and portable nullable-key contracts', () => {
    assert.deepEqual(gtfsManifest.fare_products.fields.amount!.monetary, {
      currencyField: 'currency',
      publicRepresentation: 'decimal-string',
      storageRepresentation: 'minor-units',
    });
    assert.deepEqual(gtfsManifest.fare_attributes.fields.price!.monetary, {
      currencyField: 'currency_type',
      publicRepresentation: 'decimal-string',
      storageRepresentation: 'minor-units',
    });

    const canonicalKeyTables = [
      'agency',
      'attributions',
      'fare_products',
      'fare_rules',
      'fare_leg_rules',
      'fare_leg_join_rules',
      'fare_transfer_rules',
      'timeframes',
      'transfers',
      'translations',
      'timetable_notes',
      'timetable_notes_references',
    ] as const;
    for (const tableName of canonicalKeyTables) {
      assert.equal(gtfsManifest[tableName].keyStrategy, 'canonical');
    }

    assert.deepEqual(gtfsManifest.fare_transactions.primaryKey, [
      'transaction_id',
    ]);
    assert.deepEqual(gtfsManifest.fare_transactions.storageKey, [
      'source_id',
      'transaction_id',
    ]);
    assert.deepEqual(gtfsManifest.passenger_events.primaryKey, [
      'passenger_event_id',
    ]);

    for (const tableName of [
      'board_alight',
      'ridership',
      'trip_capacity',
    ] as const) {
      assert.deepEqual(gtfsManifest[tableName].primaryKey, []);
      assert.equal(gtfsManifest[tableName].storageKey, null);
      assert.equal(gtfsManifest[tableName].keyStrategy, 'none');
    }

    for (const [tableName, table] of Object.entries(gtfsManifest)) {
      const hasNullablePrimaryKeyField = table.primaryKey.some(
        (field) => table.fields[field]!.presence !== 'required',
      );
      if (hasNullablePrimaryKeyField) {
        assert.equal(
          table.keyStrategy,
          'canonical',
          `${tableName} must enforce nullable key fields portably`,
        );
      }
    }
  });

  test('resolves every reference target, including conditional and polymorphic targets', () => {
    const joins = new Map(Object.entries(gtfsJoins));
    const files = new Map(
      Object.values(gtfsManifest).map((table) => [table.filename, table]),
    );
    for (const table of Object.values(gtfsManifest)) {
      for (const [name, field] of Object.entries(table.fields)) {
        for (const reference of field.references ?? []) {
          const context = `${table.tableName}.${name} → ${reference.targetFilename}.${reference.targetField}`;
          assert.ok(
            files.get(reference.targetFilename)?.fields[reference.targetField],
            context,
          );
          if (reference.when) {
            assert.ok(table.fields[reference.when.field], context);
          }
          if (
            reference.relationship === 'polymorphic' ||
            reference.relationship === 'conditional'
          ) {
            assert.ok(reference.when, context);
            const tableJoins = joins.get(table.tableName);
            assert.ok(tableJoins, context);
            assert.equal(
              tableJoins.some((join) => join.sourceField === name),
              false,
              context,
            );
          }
        }
      }
    }
  });

  test('retains both GTFS fare-network reference targets', () => {
    // GTFS Schedule 2026-04-27: fare_leg_rules and fare_leg_join_rules.
    for (const [tableName, fieldName] of [
      ['fare_leg_rules', 'network_id'],
      ['fare_leg_join_rules', 'from_network_id'],
      ['fare_leg_join_rules', 'to_network_id'],
    ] as const) {
      assert.deepEqual(
        gtfsManifest[tableName].fields[fieldName]?.references,
        [
          { targetFilename: 'routes.txt', targetField: 'network_id' },
          { targetFilename: 'networks.txt', targetField: 'network_id' },
        ],
        `${tableName}.${fieldName}`,
      );
    }
  });

  test('models every supported translation reference with its table_name condition', () => {
    const translations = gtfsManifest.translations;
    const expected = {
      record_id: [
        ['agency', 'agency.txt', 'agency_id'],
        ['stops', 'stops.txt', 'stop_id'],
        ['routes', 'routes.txt', 'route_id'],
        ['trips', 'trips.txt', 'trip_id'],
        ['stop_times', 'stop_times.txt', 'trip_id'],
        ['pathways', 'pathways.txt', 'pathway_id'],
        ['levels', 'levels.txt', 'level_id'],
        ['attributions', 'attributions.txt', 'attribution_id'],
        ['calendar', 'calendar.txt', 'service_id'],
        ['calendar_dates', 'calendar_dates.txt', 'service_id'],
        ['fare_attributes', 'fare_attributes.txt', 'fare_id'],
        ['fare_rules', 'fare_rules.txt', 'fare_id'],
        ['shapes', 'shapes.txt', 'shape_id'],
        ['frequencies', 'frequencies.txt', 'trip_id'],
        ['transfers', 'transfers.txt', 'from_stop_id'],
      ],
      record_sub_id: [
        ['stop_times', 'stop_times.txt', 'stop_sequence'],
        ['calendar_dates', 'calendar_dates.txt', 'date'],
        ['fare_rules', 'routes.txt', 'route_id'],
        ['frequencies', 'frequencies.txt', 'start_time'],
        ['transfers', 'stops.txt', 'stop_id'],
      ],
    } as const;
    for (const [field, targets] of Object.entries(expected)) {
      assert.deepEqual(
        translations.fields[field]?.references,
        targets.map(([tableName, targetFilename, targetField]) => ({
          targetFilename,
          targetField,
          relationship: 'polymorphic',
          when: { field: 'table_name', equals: tableName },
        })),
        field,
      );
    }
    assert.deepEqual(translations.fields.record_sub_id!.normalization, [
      {
        kind: 'source-reference',
        when: {
          field: 'table_name',
          in: ['fare_rules', 'transfers'],
        },
      },
    ]);
    assert.deepEqual(gtfsJoins.translations, []);
  });
});
