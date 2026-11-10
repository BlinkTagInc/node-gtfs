# Databases and instances

[All guides](README.md)

Start with SQLite unless your application already uses a database server.
The query, import, and export APIs work with all three supported databases.

| Database                  | Useful when…                                  | Connection                              |
| ------------------------- | --------------------------------------------- | --------------------------------------- |
| [SQLite](#sqlite)         | You want one local file with no server setup. | A path, or an existing SQLite client.   |
| [PostgreSQL](#postgresql) | Applications share a server database.         | A Kysely client with `PostgresDialect`. |
| [MySQL](#mysql)           | Your application already uses MySQL.          | A Kysely client with `MysqlDialect`.    |

## SQLite

```js
import { Gtfs } from 'gtfs';

const gtfs = new Gtfs({
  database: { path: './transit.sqlite' },
});

try {
  console.table(await gtfs.schedule.routes.all());
} finally {
  await gtfs.close();
}
```

The file must already contain imported data for this query. Creating an
instance opens a connection; it does not populate or create GTFS tables.

For a `Gtfs` instance, omit `path` or use `":memory:"` for a temporary in-memory database. Its data
disappears when the owning instance closes. To import and query in memory,
use the same instance for both operations.

The default `durability: "safe"` uses SQLite durability settings suitable for
ordinary imports and queries. File databases use WAL, so temporary `-wal`
and `-shm` files can appear alongside the main file. Do not discard an active
database’s companion files when copying or backing it up.

`durability: "unsafe-bulk"` is restricted to owned SQLite connections with
no rows in any user table, including unrelated application tables. Empty tables
are allowed. It reduces write protection during Schedule import. A crash
can lose data or leave an unusable database. Use it only for disposable data
you can import again, not when you depend on rollback or durable writes.

## PostgreSQL

Install the database packages in your application:

```sh
npm install gtfs kysely pg pg-cursor
```

Set `DATABASE_URL` to your own connection string, then create the client:

```js
import { Gtfs } from 'gtfs';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import Cursor from 'pg-cursor';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Set DATABASE_URL before running this script');
}

const database = new Kysely({
  dialect: new PostgresDialect({
    pool: new pg.Pool({ connectionString }),
    cursor: Cursor,
  }),
});

const gtfs = new Gtfs({
  database: { client: database },
  sources: [{ schedule: { path: './feed.zip' } }],
});

try {
  await gtfs.import();
  console.table(await gtfs.schedule.routes.all());
} finally {
  await gtfs.close();
  await database.destroy();
}
```

`pg-cursor` enables streamed queries and export. Array-returning queries can
work without it, but configuring it up front supports both workflows.
For TypeScript, use `new Kysely<GtfsDatabase>(...)` with
`import type { GtfsDatabase } from 'gtfs/schema'`; install `@types/pg` and
`@types/pg-cursor` as development dependencies.

## MySQL

```sh
npm install gtfs kysely mysql2
```

```js
import { Gtfs } from 'gtfs';
import { Kysely, MysqlDialect } from 'kysely';
import mysql from 'mysql2';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Set DATABASE_URL before running this script');
}

const database = new Kysely({
  dialect: new MysqlDialect({ pool: mysql.createPool(connectionString) }),
});

const gtfs = new Gtfs({
  database: { client: database },
  sources: [{ schedule: { path: './feed.zip' } }],
});

try {
  await gtfs.import();
  console.table(await gtfs.schedule.routes.all());
} finally {
  await gtfs.close();
  await database.destroy();
}
```

Use the `mysql2` pool, not its promise wrapper. For TypeScript, parameterize
Kysely with `GtfsDatabase` as in the PostgreSQL example.

Keep credentials outside committed config files. node-GTFS reads the options
you pass; loading a `.env` file is your application’s responsibility. For
example, Node can run a script with `node --env-file=.env app.mjs`.

## Source scope

Scope an instance to one or more imported sources:

```js
import { Gtfs } from 'gtfs';

const gtfs = new Gtfs({
  database: { path: './transit.sqlite' },
  sources: [{ sourceId: 'metro' }],
});

try {
  const routes = await gtfs.schedule.routes.all();
  console.table(routes);
} finally {
  await gtfs.close();
}
```

Repository queries, GeoJSON, and GTFS-Realtime cleanup respect this scope. Omit
`sources` to query all sources. GTFS IDs are not prefixed or rewritten;
`source_id` distinguishes identical IDs in different static GTFS feeds. Source scoping is
not a database permissions system: custom database access is not restricted
by it.

## Manage tables

```js
const inspection = await gtfs.schema.validate();
if (!inspection.compatible) {
  console.table(inspection.tableIssues);
}
```

| Method              | Behavior                                                                        |
| ------------------- | ------------------------------------------------------------------------------- |
| `schema.validate()` | Inspect enabled tables without changing them.                                   |
| `schema.ensure()`   | Create missing enabled tables/indexes; reject incompatible existing structures. |
| `schema.recreate()` | Drop and rebuild enabled tables, deleting their data for **all** sources.       |

All return a `GtfsSchemaInspection` with `compatible` and `tableIssues`.
`ensure()` and `recreate()` throw if the resulting schema is incompatible.
They do not affect unrelated application tables. Source scope does not make
schema recreation source-specific.

These methods take no arguments. Tables always include `_unknown_fields` and
generated time, case-insensitive comparison, and storage-key columns.
Use each source’s `validation.onUnknownField` setting to control unknown data.

Import and GTFS-Realtime refresh create missing enabled tables and indexes, and
reject incompatible existing structures. They never rebuild tables.
Routine Schedule replacement uses
[`onExistingData: "replace-source"`](import.md#replace-an-updated-static-gtfs-feed), not recreation.
Export and queries inspect the tables they need; neither creates missing data.

### Schema checks and external changes

Constructing `Gtfs` does not validate or create tables. Schema checks behave
the same whether node-GTFS owns the connection or borrows it.

Each query checks its required tables when the operation runs. A stream checks
when iteration starts, not when `stream()` is called. Export also performs a
fresh check. These checks cover the requested data; use `schema.validate()` to
inspect all enabled tables and indexes.

After external schema changes, call `schema.validate()` to inspect compatibility
without modifying tables. Its result describes the schema at that time. Later
reads check again, so repairs and changes made by another instance do not require
reopening the instance or clearing a cache. A failed check does not prevent a
later operation from succeeding after repair. Changes are visible according to
the database's transaction rules.

Coordinate external migrations with active operations and streams. A schema check
does not protect against another connection changing tables between the check
and query execution.

## Connection ownership and closing

node-GTFS closes a connection it opened from a SQLite path. A supplied
`database.client` is borrowed and remains open after `gtfs.close()`; its owner
must close it. `gtfs.database.ownership` is `"owned"` or `"borrowed"`, and
`gtfs.database.dialect` identifies the resolved database type (`'sqlite'`,
`'postgres'`, or `'mysql'`). With a supplied client, it is determined from that
client's adapter. A file path opens SQLite.

Always close instances with `try`/`finally`. Repeated `close()` calls are safe;
new operations reject once closing begins. `gtfs.isClosed` reports the closed
state. Environments with asynchronous disposal can use `await using` instead.

SQLite operations run one at a time. Finish or close a streamed result before
starting another operation on the same instance. A borrowed Kysely transaction
uses the same restriction.

When you supply a Kysely transaction, a failed Schedule source replacement or
GTFS-Realtime snapshot rolls back to a savepoint. After successful rollback and
savepoint release, you can catch the error and continue using the transaction;
node-GTFS does not commit your other work. If cleanup also fails,
[inspect both errors](reporting.md#catch-an-error) and roll back the transaction
or discard the failed connection before reusing it. Let an error with
`details.databaseRecoveryRequired === true` escape your transaction callback;
catching it and returning normally can commit partial work. node-GTFS leaves
caller-owned clients open, including after these failures.

A failed commit acknowledgement does not prove the database rolled back, even
if a later rollback succeeds. Inspect the stored data before retrying. If
settings restoration failed, restore the affected settings or replace the
connection before reuse.

For MySQL, create the required schema and indexes before opening a transaction. Imports and
GTFS-Realtime refreshes validate the existing schema in this case, because MySQL DDL
would commit the transaction.

PostgreSQL and MySQL repository queries, domain queries, GeoJSON reads, and
schema validation can overlap when the supplied pool has available connections.
Streams hold a connection until exhausted or closed. Pool size limits concurrency;
waiting for another read while streams occupy every connection can stall your
application.

Import, export, GTFS-Realtime refresh/cleanup, schema changes, and `withKysely()`
callbacks run exclusively on the instance. They wait for earlier operations,
and later reads wait for them. Finish active streams before starting these
operations; otherwise the call rejects with `GTFS_QUERY_INVALID` and reason
`STREAM_ACTIVE`.

Closing rejects new operations, releases all active streams, and waits for
already accepted operations to settle. It does not cancel in-flight SQL or
callbacks. Coordination applies to one instance; callers must coordinate other
instances and direct use of a borrowed client themselves.
To stop an import, export, or GTFS-Realtime refresh, pass an
[operation signal](cancellation.md).

## Direct database queries

Use `gtfs.database.withKysely()` for joins or expressions outside the repository
API. See [custom SQL queries](sql-queries.md#direct-database-queries) for setup,
source filters, connection rules, and examples.

## Next steps

- [Import or update a static GTFS feed](import.md).
- [Query your database](queries.md).
- [Choose the extensions your application needs](extensions.md).
- [Write custom SQL filters and joins](sql-queries.md).
- [Cancel an operation before closing](cancellation.md).
