# Troubleshooting

[All guides](README.md)

Start with the error code, filename, and source position. In JavaScript,
[structured errors and reporting](reporting.md) provide more context than a
message alone.

## I cannot run the command or example

- Check `node --version`: Node.js 22.18+ (22.x), 24, or 26+ is required.
- For the CLI, install `gtfs` globally or use `npx gtfs` from a project where
  it is installed. Run `gtfs --help` to see available commands.
- Save JavaScript examples as `.mjs`, or configure your project for ES modules.
- Run from the folder you intend: relative input, database, output, and config
  paths are resolved from the current working directory.

Follow [getting started](getting-started.md) with one local ZIP and SQLite
before adding other sources or a server database.

If the process exits with a segmentation fault when SQLite first opens, check
the Node version used by that process or service and upgrade to a supported
version above. Older Node 22 releases can crash while loading the native SQLite
driver; see the [upstream compatibility issue](https://github.com/WiseLibs/better-sqlite3/issues/1514).

## My configuration is rejected

`GTFS_CONFIG_INVALID` identifies invalid options. Check
`error.details?.errors` for paths such as
`sources[0].schedule.import.validation.mode`.

Use exactly one of Schedule `path` and `url`, and one of database `path` and
`client`. Several sources need unique `sourceId` values. Unknown keys are
rejected, including misspellings. JSON config files cannot contain comments,
trailing commas, or JavaScript functions.

The CLI reads `./config.json` automatically when present. Use an explicit
`--config` if you are unsure which file is being read. Review the
[configuration reference](reference/configuration.md) and [CLI override rules](cli.md).

## A download fails or times out

`GTFS_DOWNLOAD_HTTP_FAILED` means the server returned an unsuccessful HTTP
response. Check the URL, access token, and the error’s HTTP status. A link
that returns an HTML sign-in page is not a GTFS ZIP or a GTFS-Realtime protobuf message.

For `GTFS_DOWNLOAD_FAILED`, check connectivity and the GTFS-Realtime feed’s availability.
You can set a larger `timeoutMs` on that Schedule URL source or GTFS-Realtime
feed. Keep API keys and authorization headers out of issue reports.

`GTFS_DOWNLOAD_REDIRECT_REJECTED` means a redirect used an invalid URL,
embedded credentials, a non-HTTP(S) protocol, an HTTPS-to-HTTP downgrade, or
more than 20 redirects. The error's `details.reason` identifies the cause.
Configure the final trusted source URL directly. Redirect rejections are not retried.

If authentication fails after a redirect, check whether its protocol, hostname,
or port changed. All configured `requestHeaders` are removed after an origin
change; use the destination's trusted URL directly if it requires those headers.

`GTFS_REALTIME_PROTOBUF_INVALID` means the downloaded body could not be read
as GTFS-Realtime. Check that the URL returns protobuf, not JSON or HTML.

## A ZIP or CSV cannot be read

`GTFS_DOWNLOAD_TOO_LARGE` or `GTFS_ZIP_LIMIT_EXCEEDED` means an input exceeded
a configured size or entry-count limit. Error details include `limit`, `maximum`,
and `actual`. Check the static GTFS feed before raising a [Schedule archive limit](import.md#input-size-limits)
or a GTFS-Realtime feed's [maxDownloadBytes](reference/configuration.md#gtfs-realtime-feeds-and-retention).

`GTFS_ZIP_INVALID` can mean a corrupt archive, an unsafe path, or an ambiguous
static GTFS feed layout. A static GTFS feed can be at the ZIP root or in one nested static GTFS feed directory;
split archives with several static GTFS feeds into separate sources.

`GTFS_CSV_PARSE_FAILED` points to malformed CSV, such as unequal field counts
or broken quoting. Inspect the original file around the reported position.
Quoted fields can contain newlines, so a CSV record is not always one line.
Use a text editor that preserves encoding; saving through a spreadsheet can
change dates, identifiers, and leading zeros.

For a nonstandard delimiter or encoding, set supported
[CSV options](reference/configuration.md#csv-options). Malformed syntax still fails
even with validation off.

## Validation rejects my static GTFS feed

Static GTFS feed validation is off by default. These notices reject a static GTFS feed when strict
validation is enabled (or when an explicit unknown-field policy rejects it).

Check `details.validation.samples` for the actual field and rule. Fix the static GTFS feed
when possible. Common issues include missing headers, empty required values,
invalid times, and duplicate primary keys.
Samples are capped at 100 notices; check `details.validation.countsByCode` for
complete counts, or [save every notice](reporting.md#save-every-validation-notice).

`onDuplicateKey: "keep-first"` accepts the first record for each key.
`mode: "permissive"` allows some imperfect data to proceed, but invalid rows
may be skipped. Neither is a guarantee that every input row will be imported.
With `mode: "off"`, parsing, normalization, and database constraints still
apply; unstoreable records fail the import rather than being silently skipped.
See [validation policies](validation.md).

Reference notices can mean a referenced record is missing or that some related
files were not imported. For service IDs, a match in either `calendar.txt` or
`calendar_dates.txt` is sufficient.

## Unknown fields or disabled extensions

`GTFS_UNKNOWN_FIELD` means a header is not recognized. The default preserves
its value in the table’s `_unknown_fields` JSON column and restores it on export;
it is not a normal repository field. Choose `reject` or `discard` explicitly
if that is more appropriate.

`GTFS_EXTENSION_DISABLED` identifies data outside your enabled extension set.
Add the extension named in the notice to `extensions` and reimport to load
those files. Merely enabling its repository does not import previously skipped
data. See [extensions](extensions.md).

## The database is missing tables or has an incompatible schema

`GTFS_SCHEMA_INVALID` is not an empty query result. Check the database path
and selected extensions, then inspect:

```js
const inspection = await gtfs.schema.validate();
console.table(inspection.tableIssues);
```

`schema.ensure()` can create missing tables and indexes. It does not repair
incompatible columns. For disposable GTFS data, recreate and reimport only
after confirming you can discard **all** data in enabled tables. See
[table management](databases.md#manage-tables).

`GTFS_DATABASE_OPEN_FAILED` can indicate an invalid path, missing parent
directory, or insufficient permissions. PostgreSQL/MySQL connection failures
also require checking the server, database name, and credentials.

## My query returns no rows

- Confirm that you imported into the same database path you are querying.
- Check the instance’s `sources` scope and the records’ `source_id` values.
- IDs are strings and case-sensitive. Inspect actual route/stop IDs rather
  than assuming their display names are IDs.
- Optional files can be absent from a valid static GTFS feed, leaving empty tables.
- `serviceDate` must be within the static GTFS feed’s service dates, including exceptions.
- Schedule times beyond midnight belong to the preceding service day; use
  `25:00:00` when that is how the static GTFS feed represents the time.

Start with a simple `.limit(5).all()` query and add conditions one at a time.
An explicit `undefined` in a filter is invalid; use `null` for missing values
and omit a property to leave it unfiltered.

## Streaming or large queries fail

Awaiting `.all()` builds a complete array. For large tables, use
[`for await` iteration](queries.md#read-large-results-a-row-at-a-time) and select
only needed fields. PostgreSQL streaming and export need `pg-cursor` configured
on `PostgresDialect`.

Consume each stream only once. For SQLite, finish it before starting another
operation on the same instance. PostgreSQL/MySQL reads can overlap if the pool
has spare connections; finish streams before starting writes or custom SQL
callbacks. See [connection coordination](databases.md#connection-ownership-and-closing).
GeoJSON builds a complete FeatureCollection, so filter it when working with a
large static GTFS feed.

## GTFS-Realtime records are stale or disappear during cleanup

Refresh is one request cycle, not an automatic polling service. Confirm your
scheduler is running and inspect GTFS-Realtime notices. A full dataset removes entities
missing from that response; a differential GTFS-Realtime message preserves them until changed,
deleted, or cleaned up.

Current-entity retention defaults to `30` seconds after fetching; `0` makes
records immediately eligible for cleanup. Choose `currentEntitiesSeconds` for
the grace period you need. Expiration alone does not hide rows: schedule cleanup as well as
refresh. Repeated identical snapshots do not extend expiration; check whether
the agency is publishing new payloads. See [GTFS-Realtime retention](realtime.md#expiration-and-cleanup).

## Export is incomplete or files disappeared

Export includes only populated tables for the chosen source and enabled
extensions. Empty optional files are omitted. Multiple agencies within one
source are exported together.

Existing destinations are refused unless `export.overwrite` is `true`. With
overwrite enabled, successful generation replaces the entire directory,
including unrelated files; a generation failure leaves existing output intact.
Failed exports remove incomplete new output. If cleanup also fails, its
location is in `error.details.partialOutputDirectory`.
Use a dedicated output directory and check the returned file list after success.
See [export safety](export.md#choose-a-safe-output-directory).

An “Export completed” temporary-cleanup warning means publication succeeded;
check the returned files, then remove the reported temporary directory when no
export is using it. A reservation-release warning identifies a lock directory
that could block a later export. Confirm the exporting process has finished
before removing that reservation. If replacement and restoration both failed,
preserve `error.details.recoveryDirectory`: it contains the previous output.

## Still stuck?

[Open an issue](https://github.com/BlinkTagInc/node-gtfs/issues) with:

- Your node-GTFS and Node.js versions and database type.
- The exact command or a small code example, plus relevant configuration.
- The error code, message, and available record position.
- A link to the specific GTFS ZIP or files, when you can share them.

Remove credentials and private information. A clear problem report about a
real static GTFS feed is welcome even if you do not know how to fix it.

## Next steps

- [Capture progress and structured errors](reporting.md).
- [Check configuration names, values, and defaults](reference/configuration.md).
- [Review database setup and connection lifetime](databases.md).
- [Update a v4 application](migrating-to-v5.md).
