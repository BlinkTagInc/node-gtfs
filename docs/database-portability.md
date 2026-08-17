# Database portability and storage contract

This document defines the storage behavior that database writers should share.
It describes the current contract; it does not make the synchronous query,
export, or GTFS-Realtime APIs database-independent.

## Portable source columns

Every writer stores the same file-backed tables and source columns declared by
the GTFS schema manifest. Values are normalized before they reach a writer:

| Manifest kind                          | Portable storage intent                                |
| -------------------------------------- | ------------------------------------------------------ |
| `id`, `text`                           | Unbounded text where supported                         |
| Numeric enumeration, `integer`, `date` | Integer                                                |
| Text enumeration                       | Text                                                   |
| `real`                                 | Double-precision floating point                        |
| `time`                                 | Normalized `HH:mm:ss` text; hours may exceed 23        |
| `json`                                 | Serialized JSON text, not a database-native JSON value |

GTFS dates retain their existing `YYYYMMDD` integer representation. Empty
values are stored as `NULL` unless the manifest supplies a `defaultValue`.
Identifier feed prefixes are applied before writing.

The current floating-point representation of fares and other decimals can lose
decimal precision. Changing it to fixed-precision decimal storage would affect
result types and is deferred to the next major release.

## node-GTFS convenience and internal columns

When `includeNodeGtfsExtras` is enabled, each GTFS time column also receives an
integer seconds-since-midnight column. These are node-GTFS conveniences rather
than source GTFS columns.

Managed MySQL schemas contain a nullable `_node_gtfs_primary_key` SHA-256 value
for tables with declared keys. MySQL cannot portably index arbitrary-length
GTFS text identifiers as a native key. The hash preserves duplicate handling
without imposing a length limit; it is an internal column and should not be
treated as GTFS data.

## Constraints and comparisons

- Required values become `NOT NULL` columns in managed schemas.
- Manifest numeric bounds become database checks where supported.
- References remain metadata and are not installed as database foreign keys.
- Nullable composite keys retain the databases' normal NULL-distinct unique
  behavior.
- SQLite `caseInsensitiveComparison` uses `COLLATE NOCASE`. PostgreSQL and
  MySQL use the configured database/column collation, so comparisons are not
  guaranteed to be identical across backends.

## Import lifecycle

`manageSchema: true` is destructive: file-backed tables are dropped and
recreated before import, then indexes are created afterward. Each normalized
batch is written in a transaction. A failure in a later batch can therefore
leave earlier successful batches committed, matching existing SQLite behavior.

`manageSchema: false` leaves schema ownership with the application. All source
columns must exist. Convenience columns are written only when
`includeNodeGtfsExtras: true` is also provided.

The caller owns a Kysely instance passed to `importGtfsToKysely()`; node-GTFS
never destroys it.

## Conformance testing

CI imports the same Unicode and long-identifier fixture into real PostgreSQL
and MySQL services. It verifies normalized values, managed schema compatibility,
generated time columns, indexes, and dialect-specific duplicate/key behavior.

The integration test can also be run locally when these variables point to
disposable databases:

```sh
pnpm build
GTFS_TEST_POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/gtfs \
GTFS_TEST_MYSQL_URL=mysql://root:root@localhost:3306/gtfs \
node --test src/test/database-integration.test.ts
```

The test drops and recreates GTFS tables and must never target a database that
contains data you need to preserve.
