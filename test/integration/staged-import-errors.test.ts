import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';

import { importGtfs } from '../../src/operations.ts';
import {
  GtfsErrorCategory,
  GtfsErrorCode,
  isGtfsError,
} from '../../src/diagnostics/errors.ts';

for (const failure of ['read', 'decode', 'writer'] as const) {
  for (const onSourceError of ['abort', 'continue'] as const) {
    test(`staged ${failure} failure retains database diagnostics and rolls back with onSourceError=${onSourceError}`, async (t) => {
      const directory = await mkdtemp(
        path.join(tmpdir(), 'gtfs-replay-error-'),
      );
      const database = new Database(':memory:');
      t.after(async () => {
        database.close();
        await rm(directory, { recursive: true, force: true });
      });
      const run = (sourceId: string) =>
        importGtfs({
          database: { client: database },
          sources: [
            {
              sourceId,
              schedule: {
                path: directory,
                import: {
                  onSourceError,
                  validation: { mode: 'off', onUnknownField: 'discard' },
                },
              },
            },
          ],
          reporting: { level: 'silent' },
        });
      await writeFile(
        path.join(directory, 'routes.txt'),
        'route_id,route_type\nold,3\n',
      );
      await writeFile(
        path.join(directory, 'stops.txt'),
        'stop_id,stop_lat\nold,0\n',
      );
      await run('target');
      await run('other');
      const snapshot = () => ({
        routes: database
          .prepare('SELECT * FROM routes ORDER BY source_id')
          .all(),
        stops: database.prepare('SELECT * FROM stops ORDER BY source_id').all(),
      });
      const before = snapshot();
      await writeFile(
        path.join(directory, 'routes.txt'),
        'route_id,route_type\nnew,3\n',
      );
      await writeFile(
        path.join(directory, 'stops.txt'),
        `stop_id,stop_lat\nnew,${failure === 'writer' ? 91 : 0}\n`,
      );

      const readFailure = Object.assign(
        new Error('Temporary storage read failed'),
        { code: 'SQLITE_IOERR' },
      );
      const workingDirectories = new Set<string>();
      let routeWrites = 0;
      let replayFailed = false;
      const prepare = Database.prototype.prepare;
      t.mock.method(
        Database.prototype,
        'prepare',
        function (this: Database.Database, sql: string) {
          const statement = prepare.call(this, sql);
          if (this === database && sql.startsWith('INSERT INTO "routes"')) {
            const run = statement.run;
            t.mock.method(statement, 'run', (...args: unknown[]) => {
              const result = Reflect.apply(run, statement, args);
              routeWrites += result.changes;
              assert.equal(
                database
                  .prepare(
                    "SELECT count(*) FROM stops WHERE source_id = 'target'",
                  )
                  .pluck()
                  .get(),
                0,
              );
              return result;
            });
          }
          if (path.basename(this.name) === 'records.sqlite') {
            workingDirectories.add(path.dirname(this.name));
            if (
              sql.startsWith('SELECT ordinal, payload FROM records') &&
              failure !== 'writer'
            ) {
              const get = statement.get;
              t.mock.method(statement, 'get', (...args: unknown[]) => {
                if (args[0] !== 'stops.txt') {
                  return Reflect.apply(get, statement, args);
                }
                replayFailed = true;
                if (failure === 'read') {
                  throw readFailure;
                }
                const batch = Reflect.apply(get, statement, args) as
                  { ordinal: number; payload: Buffer } | undefined;
                assert.ok(batch);
                return {
                  ...batch,
                  payload: Buffer.from('invalid working batch'),
                };
              });
            }
          }
          return statement;
        },
      );

      const checkError = (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.DATABASE_OPERATION_FAILED);
        assert.equal(error.category, GtfsErrorCategory.DATABASE);
        assert.equal(error.details?.filename, 'stops.txt');
        assert.equal(error.details?.sourceId, 'target');
        assert.ok(error.cause instanceof Error);
        if (failure === 'writer') {
          assert.equal(
            error.message,
            'Could not store stops.txt CSV record 1 (ending at line 2)',
          );
          assert.deepEqual(error.position, {
            kind: 'csv',
            recordNumber: 1,
            csvLineNumber: 2,
          });
          assert.match(error.cause.message, /CHECK constraint failed/);
        } else {
          assert.equal(error.message, 'Could not import staged stops.txt rows');
          assert.equal(error.position, undefined);
          if (failure === 'read') {
            assert.equal(error.cause, readFailure);
            assert.equal(error.details?.databaseCode, 'SQLITE_IOERR');
          } else {
            assert.match(error.cause.message, /deserialize/i);
          }
        }
        return true;
      };
      if (onSourceError === 'abort') {
        await assert.rejects(run('target'), checkError);
      } else {
        const result = await run('target');
        assert.equal(result.success, false);
        assert.equal(result.errors.length, 1);
        checkError(result.errors[0]);
        assert.deepEqual(result.errorCountsByCode, {
          [GtfsErrorCode.DATABASE_OPERATION_FAILED]: 1,
        });
      }
      assert.equal(routeWrites, 1);
      assert.equal(replayFailed, failure !== 'writer');
      assert.deepEqual(snapshot(), before);
      assert.equal(workingDirectories.size, 1);
      for (const workingDirectory of workingDirectories) {
        await assert.rejects(stat(workingDirectory), { code: 'ENOENT' });
      }
    });
  }
}
