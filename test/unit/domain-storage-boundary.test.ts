import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import * as definitions from '../../src/schema/tables/index.ts';
import * as managedTables from '../../src/schema/managed-tables.ts';
import { defineGtfsDomainTable } from '../../src/schema/domain-table.ts';
import { compileTable } from '../../src/schema/compile-table.ts';
import { tableStoragePolicies } from '../../src/database/storage/table-policy.ts';
import { toManagedGtfsTable } from '../../src/database/storage/table-definition.ts';
import { createGtfsStoragePlan } from '../../src/database/storage/plan.ts';
import { normalizeGtfsRecord } from '../../src/values/normalize-row.ts';

test('canonical definitions contain semantic metadata and every managed table has separate storage policy', () => {
  assert.deepEqual(Object.keys(managedTables), Object.keys(definitions));
  assert.deepEqual(
    Object.keys(tableStoragePolicies).sort(),
    Object.values(definitions)
      .map(({ tableName }) => tableName)
      .sort(),
  );
  const semanticKeys = new Set([
    'filename',
    'tableName',
    'specification',
    'presence',
    'primaryKey',
    'fields',
    'constraints',
  ]);
  for (const table of Object.values(definitions)) {
    for (const key of Object.keys(table)) {
      assert.ok(semanticKeys.has(key), `${table.tableName}.${key}`);
    }
    for (const [name, field] of Object.entries(table.fields)) {
      assert.equal('storageKind' in field, false, `${table.tableName}.${name}`);
      if ('monetary' in field) {
        assert.equal('storageRepresentation' in field.monetary, false);
      }
    }
  }
});

for (const key of ['indexes', 'keyStrategy', 'storageKey']) {
  test(`domain definitions reject physical setting ${key}`, () => {
    assert.throws(
      () => defineGtfsDomainTable({ ...definitions.routes, [key]: [] }),
      { code: 'GTFS_CONFIG_INVALID' },
    );
  });
}

test('domain money metadata rejects physical representation settings', () => {
  assert.throws(
    () =>
      defineGtfsDomainTable({
        ...definitions.fareAttributes,
        fields: managedTables.fareAttributes.fields,
      }),
    { code: 'GTFS_CONFIG_INVALID' },
  );
});

test('storage tuning changes physical keys and indexes without changing parsing or domain definitions', () => {
  const domainBefore = JSON.stringify(definitions.routes);
  const ordinary = compileTable(
    toManagedGtfsTable(definitions.routes, { keyStrategy: 'columns' }),
  );
  const tuned = compileTable(
    toManagedGtfsTable(definitions.routes, {
      keyStrategy: 'canonical',
      indexes: [['source_id', 'route_type']],
    }),
  );
  const row = { route_id: 'bus', route_type: '3', route_short_name: 'B' };
  const options = {
    sourceId: 'north',
    position: { kind: 'csv' as const, recordNumber: 1, csvLineNumber: 2 },
  };
  assert.deepEqual(
    normalizeGtfsRecord(row, ordinary, options),
    normalizeGtfsRecord(row, tuned, options),
  );
  assert.equal(JSON.stringify(definitions.routes), domainBefore);
  const plan = createGtfsStoragePlan({
    dialect: 'sqlite',
    tables: [ordinary, tuned],
  });
  assert.equal(plan.tables[0]?.key.kind, 'primary-key');
  assert.equal(plan.tables[1]?.key.kind, 'unique');
  assert.deepEqual(plan.tables[1]?.indexes[0]?.columns, [
    'source_id',
    'route_type',
  ]);
});

// Follow runtime imports only: type dependencies do not load connections or IO.
async function runtimeDependencies(
  filename: string,
  visited = new Set<string>(),
): Promise<Set<string>> {
  const absolute = path.resolve(filename);
  if (visited.has(absolute)) {
    return visited;
  }
  visited.add(absolute);
  const source = await readFile(absolute, 'utf8');
  for (const match of source.matchAll(
    /\b(?:import|export)\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]/gu,
  )) {
    if (match[1]!.startsWith('type ') || !match[2]!.startsWith('.')) {
      continue;
    }
    await runtimeDependencies(
      path.resolve(path.dirname(absolute), match[2]!),
      visited,
    );
  }
  return visited;
}

test('domain definitions and value parsing do not load database, CLI, or reporting code', async () => {
  const entrypoints = [
    'src/schema/domain-table.ts',
    'src/schema/tables/index.ts',
    'src/values/parse.ts',
    'src/values/normalize-row.ts',
  ];
  for (const entry of entrypoints) {
    for (const dependency of await runtimeDependencies(entry)) {
      assert.doesNotMatch(
        dependency,
        /\/src\/(?:database|cli|bin|reporting)\//u,
        `${entry} loads ${dependency}`,
      );
    }
  }
});

test('CLI import, export, and Realtime commands call the public operations', async () => {
  for (const [filename, operation] of [
    ['import', 'importGtfs'],
    ['export', 'exportGtfs'],
    ['realtime-refresh', 'refreshGtfsRealtime'],
  ]) {
    const source = await readFile(`src/cli/${filename}.ts`, 'utf8');
    assert.ok(source.includes(`import { ${operation} } from '../index.ts'`));
    assert.doesNotMatch(
      source,
      /from ['"]\.\.\/(?:operations\.ts|schedule\/|realtime\/)/u,
    );
  }
});
