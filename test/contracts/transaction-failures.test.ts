import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import {
  Kysely,
  PostgresDialect,
  MysqlDialect,
  SqliteDialect,
  sql,
} from 'kysely';
import pg from 'pg';
import mysql from 'mysql2';
import { Gtfs } from '../../src/index.ts';
import { GtfsError, isGtfsError } from '../../src/diagnostics/errors.ts';
import { runSqliteTransaction } from '../../src/database/sqlite/transaction.ts';
import { runKyselyTransaction } from '../../src/database/kysely/transaction.ts';
import {
  databaseContract,
  openContractDatabase,
} from '../helpers/database-contract.ts';
import { withKyselyConnection } from '../../src/database/kysely/connection.ts';

function assertFailures(
  error: unknown,
  primary: unknown,
  cleanup: unknown,
  extraDetails = {},
) {
  assert.ok(isGtfsError(error));
  assert.ok(error.cause instanceof AggregateError);
  assert.deepEqual(error.cause.errors, [primary, cleanup]);
  assert.equal(error.cause.errors[0], primary);
  assert.equal(error.cause.errors[1], cleanup);
  if (isGtfsError(primary)) {
    assert.equal(error.code, primary.code);
    assert.equal(error.category, primary.category);
    assert.equal(error.message, primary.message);
    assert.equal(error.statusCode, primary.statusCode);
    assert.equal(error.isOperational, primary.isOperational);
    assert.deepEqual(error.details, {
      ...primary.details,
      ...extraDetails,
      databaseRecoveryRequired: true,
    });
    assert.deepEqual(error.position, primary.position);
    assert.deepEqual(error.positions, primary.positions);
  }
  return true;
}

for (const dialect of ['postgres', 'mysql'] as const) {
  const skip =
    !process.env[
      dialect === 'postgres' ? 'GTFS_TEST_POSTGRES_URL' : 'GTFS_TEST_MYSQL_URL'
    ];
  for (const committed of [false, true]) {
    test(
      `${dialect}: failed commit acknowledgement and rollback retain both errors (${committed ? 'committed' : 'uncommitted'})`,
      { skip, timeout: 10000 },
      async (t) => {
        const primary = new Error('commit acknowledgement failed');
        const cleanup = new Error('rollback failed');
        let releases = 0;
        const db = openContractDatabase(
          dialect,
          () => {},
          (driver) => {
            const commit = driver.commitTransaction.bind(driver);
            driver.commitTransaction = async (connection) => {
              if (committed) {
                await commit(connection);
              }
              throw primary;
            };
            driver.rollbackTransaction = async () => {
              throw cleanup;
            };
            const release = driver.releaseConnection.bind(driver);
            driver.releaseConnection = async (connection) => {
              releases += 1;
              await release(connection);
            };
          },
        );
        t.after(() => db.destroy());
        await sql`create temporary table commit_probe (id integer)`.execute(db);
        releases = 0;
        await assert.rejects(
          runKyselyTransaction(db, async (transaction) => {
            await sql`insert into commit_probe values (1)`.execute(transaction);
          }),
          (error) => {
            assertFailures(error, primary, cleanup);
            assert.ok(isGtfsError(error));
            assert.equal(error.details?.databaseRecoveryRequired, true);
            return true;
          },
        );
        assert.equal(releases, 1);
        // Reacquiring the single pooled connection would hang if reservation leaked.
        await sql`rollback`.execute(db);
        assert.deepEqual(
          (await sql`select * from commit_probe`.execute(db)).rows,
          committed ? [{ id: 1 }] : [],
        );
      },
    );
  }

  test(
    `${dialect}: a lost commit acknowledgement stays fatal even when rollback succeeds`,
    { skip, timeout: 10000 },
    async (t) => {
      const primary = new Error('commit acknowledgement lost');
      const db = openContractDatabase(
        dialect,
        () => {},
        (driver) => {
          const commit = driver.commitTransaction.bind(driver);
          driver.commitTransaction = async (connection) => {
            await commit(connection);
            throw primary;
          };
        },
      );
      t.after(() => db.destroy());
      await sql`create temporary table commit_probe (id integer)`.execute(db);
      await assert.rejects(
        runKyselyTransaction(db, async (transaction) => {
          await sql`insert into commit_probe values (1)`.execute(transaction);
        }),
        (error) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.details?.databaseRecoveryRequired, true);
          assert.equal(error.cause, primary);
          return true;
        },
      );
      assert.deepEqual(
        (await sql`select * from commit_probe`.execute(db)).rows,
        [{ id: 1 }],
      );
    },
  );

  for (const began of [false, true]) {
    test(
      `${dialect}: begin failure does not call the operation or leak the connection (${began ? 'started' : 'not started'})`,
      { skip, timeout: 10000 },
      async (t) => {
        const primary = new Error('begin failed');
        const db = openContractDatabase(
          dialect,
          () => {},
          (driver) => {
            const begin = driver.beginTransaction.bind(driver);
            driver.beginTransaction = async (...args) => {
              if (began) {
                await begin(...args);
              }
              throw primary;
            };
          },
        );
        t.after(() => db.destroy());
        await assert.rejects(
          runKyselyTransaction(db, async () =>
            assert.fail('operation must not run'),
          ),
          (error) => {
            assert.ok(isGtfsError(error));
            assert.equal(error.cause, primary);
            assert.equal(error.details?.databaseRecoveryRequired, true);
            return true;
          },
        );
        await sql`rollback`.execute(db);
        assert.deepEqual((await sql`select 1 as alive`.execute(db)).rows, [
          { alive: 1 },
        ]);
      },
    );
  }

  for (const failOperation of [false, true]) {
    test(
      `${dialect}: release failure ${failOperation ? 'retains operation and rollback errors' : 'rejects successful work'}`,
      { skip, timeout: 10000 },
      async (t) => {
        const primary = new GtfsError('Import cancelled', {
          code: 'GTFS_OPERATION_CANCELLED',
          cause: 'caller reason',
        });
        const rollback = new Error('rollback failed');
        const releaseError = new Error('release failed');
        let failRelease = true;
        const db = openContractDatabase(
          dialect,
          () => {},
          (driver) => {
            if (failOperation) {
              driver.rollbackTransaction = async () => {
                throw rollback;
              };
            }
            const release = driver.releaseConnection.bind(driver);
            driver.releaseConnection = async (connection) => {
              await release(connection);
              if (failRelease) {
                failRelease = false;
                throw releaseError;
              }
            };
          },
        );
        t.after(() => db.destroy());
        await assert.rejects(
          failOperation
            ? runKyselyTransaction(db, async () => {
                throw primary;
              })
            : withKyselyConnection(db, async (connection) =>
                sql`select 1`.execute(connection),
              ),
          (error) => {
            assert.ok(isGtfsError(error));
            assert.equal(error.details?.databaseRecoveryRequired, true);
            if (failOperation) {
              assert.equal(error.code, primary.code);
              assert.ok(error.cause instanceof AggregateError);
              assert.deepEqual(error.cause.errors, [
                primary,
                rollback,
                releaseError,
              ]);
              assert.equal(primary.cause, 'caller reason');
            } else {
              assert.equal(error.cause, releaseError);
            }
            return true;
          },
        );
        await sql`rollback`.execute(db);
        assert.deepEqual((await sql`select 1 as alive`.execute(db)).rows, [
          { alive: 1 },
        ]);
      },
    );
  }
}

databaseContract(
  'failed savepoint rollback stops source continuation and escapes the caller transaction',
  async ({ db }) => {
    const gtfs = new Gtfs({
      database: { client: db },
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.schema.recreate();
      const cleanup = new Error('savepoint rollback failed');
      const primary = new GtfsError('write failed', {
        code: 'GTFS_DATABASE_OPERATION_FAILED',
      });
      let inserts = 0;
      let reported: unknown;
      await assert.rejects(
        db.transaction().execute(async (transaction) => {
          const intercepted = transaction.withPlugin({
            transformQuery({ node, queryId }) {
              const statement = db
                .getExecutor()
                .compileQuery(node, queryId).sql;
              if (/^insert into ["`]?routes/i.test(statement)) {
                inserts += 1;
                throw primary;
              }
              if (statement.startsWith('rollback to savepoint')) {
                throw cleanup;
              }
              return node;
            },
            async transformResult({ result }) {
              return result;
            },
          });
          const nested = new Gtfs({
            database: { client: intercepted },
            reporting: { level: 'silent' },
          });
          try {
            await nested.import({
              sources: ['first', 'second'].map((sourceId) => ({
                sourceId,
                schedule: {
                  path: 'test/fixtures/complete',
                  import: { onSourceError: 'continue' as const },
                },
              })),
            });
          } catch (error) {
            reported = error;
            throw error;
          } finally {
            await nested.close();
          }
        }),
        (error) =>
          error === reported &&
          assertFailures(error, primary, cleanup, {
            sourcePath: 'test/fixtures/complete',
          }),
      );
      assert.equal(inserts, 1);
      assert.deepEqual((await sql`select * from agency`.execute(db)).rows, []);
    } finally {
      await gtfs.close();
    }
  },
);

test(
  'owned Kysely transaction: commit plus rollback failure preserves both errors and releases its reservation',
  { timeout: 5000 },
  async (t) => {
    const native = new Database(':memory:');
    const db = new Kysely<Record<string, never>>({
      dialect: new SqliteDialect({ database: native }),
    });
    t.after(() => db.destroy());
    const primary = new Error('commit failed');
    const cleanup = new Error('rollback failed');
    const prepare = native.prepare.bind(native);
    const mock = t.mock.method(native, 'prepare', (statement: string) => {
      if (statement === 'commit') {
        throw primary;
      }
      if (statement === 'rollback') {
        throw cleanup;
      }
      return prepare(statement);
    });
    await assert.rejects(
      runKyselyTransaction(db, async () => 1),
      (error) => assertFailures(error, primary, cleanup),
    );
    mock.mock.restore();
    native.exec('ROLLBACK');
    assert.equal(await runKyselyTransaction(db, async () => 7), 7);
  },
);

for (const borrowed of [false, true]) {
  test(`native SQLite: ${borrowed ? 'borrowed' : 'owned'} rollback failure preserves cancellation and its reason`, async (t) => {
    const database = new Database(':memory:');
    t.after(() => database.close());
    database.exec('CREATE TABLE pending (id INTEGER)');
    if (borrowed) {
      database.exec('BEGIN');
    }
    const reason = new Error('caller cancelled');
    const primary = Object.freeze(
      new GtfsError('Import cancelled', {
        code: 'GTFS_OPERATION_CANCELLED',
        cause: reason,
        position: { kind: 'csv', recordNumber: 3, csvLineNumber: 4 },
        details: { sourceId: 'test' },
        statusCode: 499,
        isOperational: false,
      }),
    );
    const cleanup = new Error('rollback failed');
    const exec = database.exec.bind(database);
    const statements: string[] = [];
    const mock = t.mock.method(database, 'exec', (statement: string) => {
      statements.push(statement);
      if (statement.startsWith('ROLLBACK')) {
        throw cleanup;
      }
      return exec(statement);
    });
    await assert.rejects(
      runSqliteTransaction(database, async () => {
        database.exec('INSERT INTO pending VALUES (1)');
        throw primary;
      }),
      (error) => assertFailures(error, primary, cleanup),
    );
    assert.equal(primary.cause, reason);
    assert.equal(database.inTransaction, true);
    assert.equal(
      statements.filter((statement) => statement.startsWith('ROLLBACK')).length,
      1,
    );
    mock.mock.restore();
    database.exec('ROLLBACK');
    assert.deepEqual(database.prepare('SELECT * FROM pending').all(), []);
  });
}

test('native SQLite: commit and rollback failures preserve the commit error and driver metadata', async (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  const primary = Object.assign(new Error('commit failed'), {
    code: 'SQLITE_IOERR',
  });
  const cleanup = new Error('rollback failed');
  const exec = database.exec.bind(database);
  const mock = t.mock.method(database, 'exec', (statement: string) => {
    if (statement === 'COMMIT') {
      throw primary;
    }
    if (statement === 'ROLLBACK') {
      throw cleanup;
    }
    return exec(statement);
  });
  await assert.rejects(
    runSqliteTransaction(database, async () => 1),
    (error) => {
      assertFailures(error, primary, cleanup);
      assert.ok(isGtfsError(error));
      assert.equal(error.code, 'GTFS_DATABASE_OPERATION_FAILED');
      assert.equal(error.details?.databaseCode, 'SQLITE_IOERR');
      return true;
    },
  );
  mock.mock.restore();
  database.exec('ROLLBACK');
});

test('native SQLite: successful rollback rethrows even a non-Error value unchanged', async (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  await assert.rejects(
    runSqliteTransaction(database, async () => {
      throw null;
    }),
    (error) => error === null,
  );
  assert.equal(database.inTransaction, false);
  assert.equal(await runSqliteTransaction(database, async () => 7), 7);
});

test('native SQLite: savepoint release failure retains the original error after rolling back the writes', async (t) => {
  const database = new Database(':memory:');
  t.after(() => database.close());
  database.exec('CREATE TABLE pending (id INTEGER); BEGIN');
  const primary = new Error('operation failed');
  const cleanup = new Error('release failed');
  const exec = database.exec.bind(database);
  const mock = t.mock.method(database, 'exec', (statement: string) => {
    if (statement.startsWith('ROLLBACK TO SAVEPOINT')) {
      exec(statement.split(';')[0]!);
      throw cleanup;
    }
    return exec(statement);
  });
  await assert.rejects(
    runSqliteTransaction(database, async () => {
      database.exec('INSERT INTO pending VALUES (1)');
      throw primary;
    }),
    (error) => assertFailures(error, primary, cleanup),
  );
  assert.equal(database.inTransaction, true);
  assert.deepEqual(database.prepare('SELECT * FROM pending').all(), []);
  mock.mock.restore();
  database.exec('ROLLBACK');
});

test('owned Kysely transaction: rollback failure retains an undefined rejection and releases the connection', async (t) => {
  const native = new Database(':memory:');
  const db = new Kysely<Record<string, never>>({
    dialect: new SqliteDialect({ database: native }),
  });
  t.after(() => db.destroy());
  const cleanup = new Error('rollback failed');
  const prepare = native.prepare.bind(native);
  const mock = t.mock.method(native, 'prepare', (statement: string) => {
    if (statement === 'rollback') {
      throw cleanup;
    }
    return prepare(statement);
  });
  await assert.rejects(
    runKyselyTransaction(db, async () => {
      throw undefined;
    }),
    (error) => assertFailures(error, undefined, cleanup),
  );
  mock.mock.restore();
  native.exec('ROLLBACK');
  assert.equal(await runKyselyTransaction(db, async () => 7), 7);
  const primary = new Error('operation failed');
  await assert.rejects(
    runKyselyTransaction(db, async () => {
      throw primary;
    }),
    (error) => error === primary,
  );
});

for (const phase of ['rollback', 'release'] as const) {
  databaseContract(
    `savepoint ${phase} failure retains the original diagnostic and caller ownership`,
    async ({ db }) => {
      const primary = new GtfsError('Invalid feed', {
        code: 'GTFS_INVALID_VALUE',
        positions: [{ kind: 'realtime', entityNumber: 2 }],
      });
      const cleanup = new Error(`${phase} failed`);
      const attempts: string[] = [];
      const callerRollback = new Error('caller rollback');
      await sql`create temporary table cleanup_probe (id integer)`.execute(db);
      await assert.rejects(
        db.transaction().execute(async (transaction) => {
          const intercepted = transaction.withPlugin({
            transformQuery({ node }) {
              if (node.kind === 'RawNode') {
                const statement = node.sqlFragments.join('');
                attempts.push(statement);
                if (
                  statement.startsWith(
                    phase === 'rollback'
                      ? 'rollback to savepoint'
                      : 'release savepoint',
                  )
                ) {
                  throw cleanup;
                }
              }
              return node;
            },
            async transformResult({ result }) {
              return result;
            },
          });
          await assert.rejects(
            runKyselyTransaction(intercepted, async () => {
              await sql`insert into cleanup_probe values (1)`.execute(
                intercepted,
              );
              throw primary;
            }),
            (error) => assertFailures(error, primary, cleanup),
          );
          assert.equal(
            attempts.filter((statement) => statement.startsWith('rollback'))
              .length,
            1,
          );
          assert.equal(
            attempts.filter((statement) => statement.startsWith('release'))
              .length,
            phase === 'release' ? 1 : 0,
          );
          assert.deepEqual(
            (await sql`select 1 as alive`.execute(transaction)).rows,
            [{ alive: 1 }],
          );
          assert.deepEqual(
            (await sql`select * from cleanup_probe`.execute(transaction)).rows,
            phase === 'rollback' ? [{ id: 1 }] : [],
          );
          throw callerRollback;
        }),
        (error) => error === callerRollback,
      );
      assert.deepEqual(
        (await sql`select * from cleanup_probe`.execute(db)).rows,
        [],
      );
      assert.deepEqual((await sql`select 1 as alive`.execute(db)).rows, [
        { alive: 1 },
      ]);
    },
  );
}

for (const borrowed of [false, true]) {
  for (const dialect of ['postgres', 'mysql'] as const) {
    const url =
      process.env[
        dialect === 'postgres'
          ? 'GTFS_TEST_POSTGRES_URL'
          : 'GTFS_TEST_MYSQL_URL'
      ];
    test(
      `${dialect}: a lost connection preserves the operation failure when ${borrowed ? 'savepoint' : 'transaction'} rollback fails`,
      {
        skip: url === undefined,
        timeout: 15_000,
      },
      async (t) => {
        const pool =
          dialect === 'postgres'
            ? new pg.Pool({ connectionString: url!, max: 1 })
            : undefined;
        // A terminated PostgreSQL session can emit an error while no query is active.
        pool?.on('connect', (client) => client.on('error', () => {}));
        const db = new Kysely<Record<string, never>>({
          dialect: pool
            ? new PostgresDialect({ pool })
            : new MysqlDialect({
                pool: mysql.createPool({ uri: url!, connectionLimit: 1 }),
              }),
        });
        const control = openContractDatabase(dialect);
        t.after(async () => {
          await db.destroy();
          await control.destroy();
        });
        const primary = new GtfsError('Import cancelled', {
          code: 'GTFS_OPERATION_CANCELLED',
          cause: new Error('caller cancelled'),
        });
        let caught: unknown;
        const execute = async (connection: Kysely<Record<string, never>>) => {
          try {
            await runKyselyTransaction(connection, async (transaction) => {
              const {
                rows: [row],
              } = await (
                dialect === 'postgres'
                  ? sql<{ id: number }>`select pg_backend_pid() as id`
                  : sql<{ id: number }>`select connection_id() as id`
              ).execute(transaction);
              assert.ok(row);
              if (dialect === 'postgres') {
                await sql`select pg_terminate_backend(${row.id})`.execute(
                  control,
                );
              } else {
                await sql`kill connection ${sql.lit(row.id)}`.execute(control);
              }
              await assert.rejects(sql`select 1`.execute(transaction));
              throw primary;
            });
          } catch (error) {
            caught = error;
            throw error;
          }
        };
        await assert.rejects(
          borrowed ? db.transaction().execute(execute) : execute(db),
        );
        assert.ok(isGtfsError(caught));
        assert.ok(caught.cause instanceof AggregateError);
        const cleanup: unknown = caught.cause.errors[1];
        assert.ok(cleanup instanceof Error);
        assertFailures(caught, primary, cleanup);
        // The caller-owned pool remains open and replaces the dead connection.
        assert.deepEqual((await sql`select 1 as alive`.execute(db)).rows, [
          { alive: 1 },
        ]);
      },
    );
  }
}
