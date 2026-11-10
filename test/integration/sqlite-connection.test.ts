import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { deleteSqliteDatabase, openSqliteDatabase } from '../../src/sqlite.ts';

test('deleting an in-memory database closes it and is safe to repeat', () => {
  const database = openSqliteDatabase();
  database.exec('create table sample (id integer)');
  deleteSqliteDatabase(database);
  assert.equal(database.open, false);
  assert.throws(() => database.prepare('select * from sample'), /not open/);
  assert.doesNotThrow(() => deleteSqliteDatabase(database));
});

for (const initiallyClosed of [false, true]) {
  test(`deletes ${initiallyClosed ? 'a closed' : 'an open'} file-backed database without touching neighboring files`, async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-delete-db-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const databasePath = path.join(directory, 'database.sqlite');
    const neighbor = path.join(directory, 'keep.txt');
    await writeFile(neighbor, 'untouched');
    const database = openSqliteDatabase({ path: databasePath });
    t.after(() => database.close());
    database.exec(
      'create table sample (id integer); insert into sample values (1)',
    );
    if (initiallyClosed) {
      database.close();
    }
    deleteSqliteDatabase(database);
    assert.equal(database.open, false);
    await assert.rejects(readFile(databasePath), { code: 'ENOENT' });
    assert.equal(await readFile(neighbor, 'utf8'), 'untouched');
    assert.deepEqual(await readdir(directory), ['keep.txt']);
  });
}

test('deleting an already-missing database reports ENOENT and leaves the handle closed', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-delete-missing-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const databasePath = path.join(directory, 'database.sqlite');
  const database = openSqliteDatabase({ path: databasePath });
  t.after(() => database.close());
  database.close();
  await unlink(databasePath);
  assert.throws(() => deleteSqliteDatabase(database), {
    code: 'ENOENT',
    path: databasePath,
    syscall: 'unlink',
  });
  assert.equal(database.open, false);
  assert.deepEqual(await readdir(directory), []);
});
