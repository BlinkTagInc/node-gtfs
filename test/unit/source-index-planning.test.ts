import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compiledTableRegistry,
  compiledTables,
} from '../../src/schema/table-registry.ts';
import {
  createGtfsStoragePlan,
  getGtfsTableStoragePlan,
} from '../../src/database/storage/plan.ts';

for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  test(`${dialect} plans a source lookup index only when its physical key and configured indexes cannot provide one`, () => {
    for (const table of compiledTables) {
      const plan = createGtfsStoragePlan({
        dialect,
        tables: [table],
      });
      const tablePlan = getGtfsTableStoragePlan(plan, table.tableName);
      const configuredSourceIndex = (table.indexes ?? []).some(
        (index) =>
          (typeof index === 'string' ? index : index[0]) === 'source_id',
      );
      const addedSourceIndexes = tablePlan.indexes.filter(
        (index) =>
          index.columns.length === 1 && index.columns[0] === 'source_id',
      );
      const configuredStandaloneIndex = (table.indexes ?? []).some(
        (index) =>
          index === 'source_id' ||
          (Array.isArray(index) &&
            index.length === 1 &&
            index[0] === 'source_id'),
      );
      assert.equal(
        addedSourceIndexes.length,
        configuredStandaloneIndex ||
          (tablePlan.key.columns[0] !== 'source_id' && !configuredSourceIndex)
          ? 1
          : 0,
        table.tableName,
      );
      assert.ok(
        tablePlan.key.columns[0] === 'source_id' ||
          tablePlan.indexes.some((index) => index.columns[0] === 'source_id'),
        table.tableName,
      );
      for (const index of addedSourceIndexes) {
        assert.deepEqual(index.prefixLengths, [
          dialect === 'mysql' ? 191 : null,
        ]);
        assert.ok(Object.isFrozen(index));
        assert.ok(Object.isFrozen(index.columns));
      }
    }
  });

  test(`${dialect} trips and stop_times use a source-leading physical key or a fallback index`, () => {
    const plan = createGtfsStoragePlan({
      dialect,
      tables: [
        compiledTableRegistry.trips,
        compiledTableRegistry.stopTimes,
        compiledTableRegistry.stops,
      ],
    });
    for (const tableName of ['trips', 'stop_times']) {
      const tablePlan = getGtfsTableStoragePlan(plan, tableName);
      assert.equal(
        tablePlan.indexes.some(
          (index) => index.name === `idx_${tableName}_source_id`,
        ),
        dialect === 'mysql',
      );
    }
    assert.equal(
      getGtfsTableStoragePlan(plan, 'stops').indexes.some(
        (index) => index.name === 'idx_stops_source_id',
      ),
      false,
    );
  });

  test(`${dialect} does not treat a non-leading source column as a source lookup path`, () => {
    const table = {
      ...compiledTableRegistry.trips,
      keyStrategy: 'canonical' as const,
      indexes: [['trip_id', 'source_id']],
    };
    const plan = createGtfsStoragePlan({ dialect, tables: [table] });
    assert.ok(
      getGtfsTableStoragePlan(plan, 'trips').indexes.some(
        (index) => index.name === 'idx_trips_source_id',
      ),
    );
  });
}
