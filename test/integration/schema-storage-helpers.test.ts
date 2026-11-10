import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GTFS_CANONICAL_KEY_COLUMN } from '../../src/schema/compile-table.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import { getCaseFoldColumnName } from '../../src/values/case-fold.ts';
import {
  createGtfsStoragePlan,
  getGtfsTableStoragePlan,
  MYSQL_STORAGE_KEY_HASH_COLUMN,
} from '../../src/database/storage/plan.ts';
import {
  createGtfsStorageRowProjector,
  createGtfsStorageValuesProjector,
  projectGtfsStorageRow,
} from '../../src/database/storage/row-projection.ts';
import { digestGtfsCanonicalKey } from '../../src/database/storage/key.ts';
import { compareGtfsStoragePlan } from '../../src/database/schema-metadata.ts';

describe('schema storage helpers', () => {
  it('preserves selected column order and independent projected values', () => {
    const plan = createGtfsStoragePlan({
      dialect: 'sqlite',
      tables: [compiledTableRegistry.agency],
    });
    const table = getGtfsTableStoragePlan(plan, 'agency');
    const names = [
      getCaseFoldColumnName('agency_name'),
      'agency_id',
      GTFS_CANONICAL_KEY_COLUMN,
      'source_id',
    ];
    const columns = names.map((name) => {
      const column = table.columns.find((column) => column.name === name);
      assert.ok(column);
      return column;
    });
    const project = createGtfsStorageValuesProjector(table, columns);
    const first = project({ source_id: 'first', agency_name: 'Straße' });
    const second = project({ source_id: 'second', agency_id: '' });
    assert.deepEqual(first, [
      'strasse',
      null,
      digestGtfsCanonicalKey(['first', null]),
      'first',
    ]);
    assert.deepEqual(second, [
      null,
      '',
      digestGtfsCanonicalKey(['second', '']),
      'second',
    ]);
    assert.notEqual(first, second);
  });

  it('reuses compiled physical mappings across rows and dialects', () => {
    for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
      const plan = createGtfsStoragePlan({
        dialect,
        tables: [
          compiledTableRegistry.agency,
          compiledTableRegistry.stopTimes,
          compiledTableRegistry.fareProducts,
        ],
      });
      for (const tablePlan of plan.tables) {
        const columns = tablePlan.columns.filter(
          ({ role }) => dialect !== 'sqlite' || role !== 'service-time',
        );
        let columnReads = 0;
        const trackedPlan = {
          ...tablePlan,
          get columns() {
            columnReads += 1;
            return columns;
          },
        };
        const project = createGtfsStorageRowProjector(trackedPlan);
        const projectValues = createGtfsStorageValuesProjector(
          tablePlan,
          columns,
        );
        const before = JSON.stringify(tablePlan);
        for (const row of [
          {
            source_id: 'first',
            agency_id: null,
            agency_name: 'Straße Transit',
            trip_id: 'trip',
            stop_sequence: 1,
            arrival_time: '25:00:00',
            arrival_service_day_seconds: 90000,
            fare_product_id: 'fare',
            amount: 250n,
            currency: 'USD',
            _unknown_fields: '{"custom":"value"}',
          },
          { source_id: 'second' },
        ]) {
          const stored = project(row);
          assert.deepEqual(
            projectValues(row),
            columns.map(({ name }) => stored[name]),
          );
          assert.deepEqual(
            stored,
            projectGtfsStorageRow(tablePlan, row, columns),
          );
          assert.deepEqual(
            Object.keys(stored),
            columns.map(({ name }) => name),
          );
          assert.equal(stored.source_id, row.source_id);
          if (dialect === 'sqlite') {
            assert.equal(
              Object.hasOwn(stored, 'arrival_service_day_seconds'),
              false,
            );
          }
        }
        assert.equal(columnReads, 1);
        assert.equal(JSON.stringify(tablePlan), before);
      }
    }
  });

  it('compiles and freezes generated columns once', () => {
    const storagePlan = createGtfsStoragePlan({
      dialect: 'sqlite',
      tables: [compiledTableRegistry.agency],
    });
    const tablePlan = getGtfsTableStoragePlan(storagePlan, 'agency');
    const columns = tablePlan.columnNames;

    assert.equal(columns.includes(getCaseFoldColumnName('agency_name')), true);
    assert.equal(columns.includes(GTFS_CANONICAL_KEY_COLUMN), true);
    assert.equal(Object.isFrozen(storagePlan), true);
    assert.equal(Object.isFrozen(storagePlan.tables), true);
    assert.equal(Object.isFrozen(tablePlan), true);
    assert.equal(Object.isFrozen(tablePlan.columns), true);
    assert.equal(Object.isFrozen(tablePlan.columns[0]!.checks), true);
    assert.equal(Object.isFrozen(tablePlan.key), true);
    assert.equal(Object.isFrozen(tablePlan.key.columns), true);
    assert.equal(Object.isFrozen(tablePlan.indexes), true);
  });

  it('plans types, defaults, checks, derivations, keys, and index prefixes', () => {
    const plan = createGtfsStoragePlan({
      dialect: 'mysql',
      tables: [
        compiledTableRegistry.routes,
        compiledTableRegistry.stops,
        compiledTableRegistry.stopTimes,
        compiledTableRegistry.transfers,
        compiledTableRegistry.fareAttributes,
      ],
    });
    const routes = getGtfsTableStoragePlan(plan, 'routes');
    const routeType = routes.columns.find(
      (column) => column.name === 'route_type',
    )!;
    assert.equal(routeType.dataType, 'integer');
    assert.equal(routeType.required, true);
    assert.equal(routeType.binaryCollation, false);
    assert.deepEqual(routeType.checks, [
      { kind: 'range', minimum: 0 },
      { kind: 'storage-class', storageClass: 'integer' },
    ]);
    assert.deepEqual(routes.key, {
      kind: 'unique',
      name: 'unique_routes_storage_key',
      columns: [MYSQL_STORAGE_KEY_HASH_COLUMN],
    });
    assert.deepEqual(routes.indexes[0]!.prefixLengths, [191]);
    const stops = getGtfsTableStoragePlan(plan, 'stops');
    assert.deepEqual(
      stops.indexes.find(
        ({ name }) => name === 'idx_stops_source_id_stop_lat_stop_lon',
      )?.prefixLengths,
      [191, null, null],
      'MySQL must prefix library-defined text columns as well as GTFS fields',
    );

    const stopTimes = getGtfsTableStoragePlan(plan, 'stop_times');
    const arrivalSeconds = stopTimes.columns.find(
      (column) => column.name === 'arrival_service_day_seconds',
    )!;
    assert.deepEqual(arrivalSeconds.generatedValue, {
      kind: 'service-time-seconds',
      sourceColumnName: 'arrival_time',
    });
    assert.deepEqual(
      stopTimes.indexes.find(({ columns }) =>
        columns.includes('arrival_service_day_seconds'),
      )?.prefixLengths,
      [191, null],
    );

    const transfers = getGtfsTableStoragePlan(plan, 'transfers');
    assert.equal(
      transfers.columns.find((column) => column.name === 'transfer_type')
        ?.defaultValue,
      0,
    );
    const fareAttributes = getGtfsTableStoragePlan(plan, 'fare_attributes');
    assert.equal(
      fareAttributes.columns.find((column) => column.name === 'price')
        ?.dataType,
      'bigint',
    );
  });

  it('resolves physical keys consistently for every dialect', () => {
    for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
      const plan = createGtfsStoragePlan({
        dialect,
        tables: [
          compiledTableRegistry.agency,
          compiledTableRegistry.routes,
          compiledTableRegistry.boardAlight,
        ],
      });
      assert.equal(
        getGtfsTableStoragePlan(plan, 'agency').physicalKeyStrategy,
        'canonical',
      );
      assert.equal(
        getGtfsTableStoragePlan(plan, 'routes').physicalKeyStrategy,
        dialect === 'mysql' ? 'hash' : 'columns',
      );
      assert.equal(
        getGtfsTableStoragePlan(plan, 'board_alight').physicalKeyStrategy,
        'none',
      );
      assert.equal(
        getGtfsTableStoragePlan(plan, 'routes').columnNames.includes(
          MYSQL_STORAGE_KEY_HASH_COLUMN,
        ),
        dialect === 'mysql',
      );
    }
  });

  it('compares normalized physical schema metadata in one shared policy', () => {
    const plan = createGtfsStoragePlan({
      dialect: 'sqlite',
      tables: [compiledTableRegistry.transfers],
    });
    const tablePlan = getGtfsTableStoragePlan(plan, 'transfers');
    const inspection = compareGtfsStoragePlan(
      plan,
      {
        tables: [
          {
            name: 'transfers',
            columns: tablePlan.columns
              .filter((column) => column.name !== 'from_stop_id')
              .map((column) => ({
                name: column.name,
                dataType:
                  column.dataType === 'bigint' || column.dataType === 'date'
                    ? 'integer'
                    : ['json', 'key-digest', 'text', 'time'].includes(
                          column.dataType,
                        )
                      ? 'text'
                      : column.dataType,
                nullable: column.name === 'source_id' ? true : !column.required,
                hasDefaultValue:
                  column.name === 'transfer_type'
                    ? false
                    : column.defaultValue !== undefined,
                generated: false,
              })),
          },
        ],
        indexes: [],
      },
      { includeIndexes: true },
    );

    assert.deepEqual(inspection, {
      compatible: false,
      tableIssues: [
        {
          tableName: 'transfers',
          missingTable: false,
          missingColumns: ['from_stop_id'],
          unexpectedlyNullableColumns: ['source_id'],
          missingDefaultColumns: ['transfer_type'],
          missingIndexes: [
            'idx_transfers_to_stop_id',
            'idx_transfers_source_id',
          ],
          incompatibleColumnTypes: [],
          incompatibleGeneratedColumns: [],
          incompatibleStorageKey: true,
        },
      ],
    });
  });

  it('includes nullable unknown-field storage, generated time, case-fold, and key columns in every dialect', () => {
    for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
      const plan = createGtfsStoragePlan({
        dialect,
        tables: [
          compiledTableRegistry.agency,
          compiledTableRegistry.routes,
          compiledTableRegistry.stopTimes,
        ],
      });

      assert.equal(
        getGtfsTableStoragePlan(plan, 'agency').physicalKeyStrategy,
        'canonical',
      );
      assert.equal(
        getGtfsTableStoragePlan(plan, 'routes').physicalKeyStrategy,
        dialect === 'mysql' ? 'hash' : 'columns',
      );
      const agency = getGtfsTableStoragePlan(plan, 'agency');
      assert.ok(agency.columnNames.includes(GTFS_CANONICAL_KEY_COLUMN));
      assert.ok(
        agency.columnNames.includes(getCaseFoldColumnName('agency_name')),
      );
      const stopTimes = getGtfsTableStoragePlan(plan, 'stop_times');
      assert.ok(stopTimes.columnNames.includes('arrival_service_day_seconds'));
      assert.ok(
        stopTimes.columnNames.includes('departure_service_day_seconds'),
      );
      assert.ok(
        stopTimes.indexes.some(({ columns }) =>
          columns.includes('arrival_service_day_seconds'),
        ),
      );
      for (const table of plan.tables) {
        const extras = table.columns.find(
          ({ name }) => name === '_unknown_fields',
        );
        assert.ok(extras);
        assert.equal(extras.required, false);
        assert.equal(extras.dataType, 'json');
        assert.notEqual(table.key.kind, 'none');
        if (table.physicalKeyStrategy === 'hash') {
          assert.ok(table.columnNames.includes(MYSQL_STORAGE_KEY_HASH_COLUMN));
        }
      }
    }
  });

  it('projects every physical row role through one shared policy', () => {
    const sqlitePlan = createGtfsStoragePlan({
      dialect: 'sqlite',
      tables: [compiledTableRegistry.agency, compiledTableRegistry.stopTimes],
    });
    const agencyPlan = getGtfsTableStoragePlan(sqlitePlan, 'agency');
    const agencyRow = projectGtfsStorageRow(agencyPlan, {
      source_id: 'source',
      agency_id: null,
      agency_name: 'Straße Transit',
      _unknown_fields: '{"custom":"value"}',
    });

    assert.equal(agencyRow.source_id, 'source');
    assert.equal(
      agencyRow[getCaseFoldColumnName('agency_name')],
      'strasse transit',
    );
    assert.equal(
      agencyRow[GTFS_CANONICAL_KEY_COLUMN],
      digestGtfsCanonicalKey(['source', null]),
    );
    assert.equal(agencyRow._unknown_fields, '{"custom":"value"}');

    const stopTimesPlan = getGtfsTableStoragePlan(sqlitePlan, 'stop_times');
    const stopTimeRow = projectGtfsStorageRow(stopTimesPlan, {
      source_id: 'source',
      trip_id: 'trip',
      stop_sequence: 1,
      arrival_time: '09:05:01',
      arrival_service_day_seconds: 32_701,
    });
    assert.equal(stopTimeRow.arrival_service_day_seconds, 32_701);

    const mysqlPlan = createGtfsStoragePlan({
      dialect: 'mysql',
      tables: [compiledTableRegistry.routes],
    });
    const routeRow = projectGtfsStorageRow(
      getGtfsTableStoragePlan(mysqlPlan, 'routes'),
      { source_id: 'source', route_id: 'route' },
    );
    assert.equal(
      routeRow[MYSQL_STORAGE_KEY_HASH_COLUMN],
      '0480ad91e48ad1f47263ddb594b478adee6a10e0aad4f987b766367e4a662739',
    );
  });
});
