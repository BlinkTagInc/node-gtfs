import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import Database from 'better-sqlite3';

import { deleteSqliteSourceData } from '../../src/database/sqlite/source-data.ts';

for (const schema of [
  'CREATE TABLE rows (source_id TEXT, id INTEGER, PRIMARY KEY(source_id, id))',
  'CREATE TABLE rows (source_id TEXT, id INTEGER, PRIMARY KEY(source_id, id)) WITHOUT ROWID',
  'CREATE TABLE rows (source_id TEXT, id INTEGER, rowid TEXT)',
]) {
  test(`deletion yields within one transaction and preserves other sources: ${schema}`, async (t) => {
    const database = new Database(':memory:');
    t.after(() => database.close());
    database.exec(schema);
    const insert = database.prepare(
      'INSERT INTO rows (source_id, id) VALUES (?, ?)',
    );
    database.transaction(() => {
      for (let index = 0; index < 2500; index++) {
        insert.run('target', index);
        insert.run('other', index);
      }
    })();
    const count = database
      .prepare('SELECT COUNT(*) FROM rows WHERE source_id = ?')
      .pluck();
    let observed: unknown;
    let wasInTransaction = false;
    const observation = setImmediate().then(() => {
      observed = count.get('target');
      wasInTransaction = database.inTransaction;
    });
    await deleteSqliteSourceData({
      database,
      sourceId: 'target',
      tableNames: ['rows'],
    });
    await observation;
    assert.equal(typeof observed, 'number');
    assert.ok(typeof observed === 'number' && observed > 0 && observed < 2500);
    assert.equal(wasInTransaction, true);
    assert.equal(database.inTransaction, false);
    assert.equal(count.get('target'), 0);
    assert.equal(count.get('other'), 2500);
  });
}

test('a later deletion batch failure rolls back earlier batches', async (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  database.exec('CREATE TABLE rows (source_id TEXT, id INTEGER PRIMARY KEY)');
  const insert = database.prepare('INSERT INTO rows VALUES (?, ?)');
  database.transaction(() => {
    for (let index = 0; index < 2500; index++) {
      insert.run('target', index);
    }
  })();
  database.exec(
    "CREATE TRIGGER fail_delete BEFORE DELETE ON rows WHEN OLD.id = 1500 BEGIN SELECT RAISE(ABORT, 'injected batch failure'); END",
  );
  await assert.rejects(
    deleteSqliteSourceData({
      database,
      sourceId: 'target',
      tableNames: ['rows'],
    }),
    /injected batch failure/u,
  );
  assert.equal(database.inTransaction, false);
  assert.equal(
    database.prepare('SELECT COUNT(*) FROM rows').pluck().get(),
    2500,
  );
});
