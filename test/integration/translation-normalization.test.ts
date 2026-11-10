import assert from 'node:assert/strict';

import { importGtfs } from '../../src/index.ts';
import { closeSqliteDatabase, openSqliteDatabase } from '../../src/sqlite.ts';
import { normalizeGtfsRecord } from '../../src/values/normalize-row.ts';
import { compileTable } from '../../src/schema/compile-table.ts';
import { translations } from '../../src/schema/managed-tables.ts';
import { describe, it } from 'node:test';

const compiledTranslations = compileTable(translations);

function normalizeTranslation(
  tableName: string,
  recordId: string | null,
  recordSubId: string | null,
) {
  return normalizeGtfsRecord(
    {
      table_name: tableName,
      field_name: 'example_name',
      language: 'es',
      translation: 'Ejemplo',
      record_id: recordId,
      record_sub_id: recordSubId,
    },
    compiledTranslations,
    {
      position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
      sourceId: 'translation-source',
    },
  );
}

describe('polymorphic translation normalization', () => {
  it('retains every official ID and stop sequence beside source identity', () => {
    for (const tableName of [
      'agency',
      'stops',
      'routes',
      'trips',
      'pathways',
      'levels',
      'attributions',
    ]) {
      const row = normalizeTranslation(tableName, 'source-id', null);
      assert.equal(row.source_id, 'translation-source');
      assert.equal(row.record_id, 'source-id');
      assert.equal(row.record_sub_id, null);
    }

    const stopTime = normalizeTranslation('stop_times', 'trip-a', '5');
    assert.equal(stopTime.record_id, 'trip-a');
    assert.equal(stopTime.record_sub_id, '5');
  });

  it('handles each recommended unofficial sub-ID by its actual value role', () => {
    const cases = [
      ['calendar', 'service-a', null, 'service-a', null],
      ['calendar_dates', 'service-a', '20260826', 'service-a', '20260826'],
      ['fare_attributes', 'fare-a', null, 'fare-a', null],
      ['fare_rules', 'fare-a', 'route-a', 'fare-a', 'route-a'],
      ['shapes', 'shape-a', null, 'shape-a', null],
      ['frequencies', 'trip-a', '25:00:00', 'trip-a', '25:00:00'],
      ['transfers', 'stop-from', 'stop-to', 'stop-from', 'stop-to'],
    ] as const;

    for (const [
      tableName,
      recordId,
      subId,
      expectedId,
      expectedSubId,
    ] of cases) {
      const row = normalizeTranslation(tableName, recordId, subId);
      assert.equal(row.record_id, expectedId, tableName);
      assert.equal(row.record_sub_id, expectedSubId, tableName);
    }
  });

  it('does not transform values whose role is unknown or not an ID', () => {
    const custom = normalizeTranslation(
      'custom_table',
      'opaque-id',
      'opaque-sub',
    );
    assert.equal(custom.record_id, 'opaque-id');
    assert.equal(custom.record_sub_id, 'opaque-sub');

    const fieldValue = normalizeGtfsRecord(
      {
        table_name: 'stops',
        field_name: 'stop_name',
        language: 'es',
        translation: 'Parada',
        field_value: 'stop-a',
      },
      compiledTranslations,
      {
        position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
        sourceId: 'translation-source',
      },
    );
    assert.equal(fieldValue.field_value, 'stop-a');
  });

  it('imports the documented matrix and enforces null-containing uniqueness', async () => {
    const db = openSqliteDatabase();
    try {
      await importGtfs({
        database: { client: db },
        sources: [
          {
            sourceId: 'translations',
            schedule: {
              path: 'test/fixtures/translations-polymorphic',
              import: {
                validation: {
                  mode: 'permissive',
                  onUnknownField: 'discard',
                  onDuplicateKey: 'keep-first',
                },
              },
            },
          },
        ],
        reporting: { level: 'silent' },
      });

      const rows = db
        .prepare(
          `SELECT table_name, record_id, record_sub_id
           FROM translations
           ORDER BY table_name`,
        )
        .all() as Array<{
        table_name: string;
        record_id: string | null;
        record_sub_id: string | null;
      }>;

      assert.equal(rows.length, 17);
      assert.deepEqual(
        rows.find(({ table_name }) => table_name === 'stop_times'),
        {
          table_name: 'stop_times',
          record_id: 'trip-a',
          record_sub_id: '5',
        },
      );
      assert.deepEqual(
        rows.find(({ table_name }) => table_name === 'fare_rules'),
        {
          table_name: 'fare_rules',
          record_id: 'fare-a',
          record_sub_id: 'route-a',
        },
      );
      assert.deepEqual(
        rows.find(({ table_name }) => table_name === 'frequencies'),
        {
          table_name: 'frequencies',
          record_id: 'trip-a',
          record_sub_id: '25:00:00',
        },
      );
      assert.deepEqual(
        rows.find(({ table_name }) => table_name === 'transfers'),
        {
          table_name: 'transfers',
          record_id: 'stop-from',
          record_sub_id: 'stop-to',
        },
      );
    } finally {
      closeSqliteDatabase(db);
    }
  });
});
