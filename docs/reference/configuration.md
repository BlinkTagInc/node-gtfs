# Configuration reference

[All guides](../README.md) · [Configure node-GTFS](../configuration.md)

Look up option names, accepted values, and defaults here. For sample files,
loading configuration, and examples, see [Configure node-GTFS](../configuration.md).

- [Top-level groups](#top-level-groups)
- [Database](#database)
- [Sources and Schedule import settings](#sources)
- [GTFS-Realtime feeds and retention](#gtfs-realtime-feeds-and-retention)
- [Export and reporting](#export-and-reporting)
- [Instance operation options](#instance-operation-options)

## How to read this reference

Each table gives the option's purpose, accepted values, and default. Nested
tables state which object their keys belong to. Omitting an optional object
uses the defaults for its children; it does not create a GTFS-Realtime feed.
`None` means no value is supplied automatically.

A **safe integer** is a whole number no larger than `9007199254740991`.
Positive means at least `1`; non-negative includes `0`. Byte limits use
`1048576` bytes per MiB and `1073741824` bytes per GiB.

## Top-level groups

| Option       | Description                                                                                                               | Accepted values                                                                      | Default                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `database`   | Where imported data is stored and queries are run.                                                                        | Database settings object.                                                            | Required.                                                            |
| `export`     | Destination, source selection, and batch settings for export.                                                             | Export settings object.                                                              | Child defaults below.                                                |
| `extensions` | Optional formats to import, export, and query alongside Schedule. Enable only the formats you need.                       | Array of extension names listed below; `"auto"` for standalone Schedule import only. | `[]`                                                                 |
| `realtime`   | Retention settings shared by all GTFS-Realtime feeds.                                                                     | Object containing `retention`.                                                       | Child defaults below.                                                |
| `reporting`  | Controls which progress messages and diagnostics are delivered, and where.                                                | Reporting settings object.                                                           | JavaScript is silent; the CLI supplies a console reporter.           |
| `sources`    | Data sources and their identities. An instance also uses these identities to scope repository queries and GeoJSON output. | Array of source objects; non-empty for import and refresh.                           | Required for import/refresh; otherwise `[]` (no source restriction). |

### Extensions

`extensions` accepts an array containing `"gtfs-realtime"`, `"gtfs-plus"`,
`"gtfs-ride"`, `"gtfs-to-html"`, `"tods"`, or `"tides"`. Core GTFS Schedule
is always enabled; do not include `"gtfs-schedule"` in the array. Duplicate
entries are rejected.

For `importGtfs()` or `gtfs import`, `"auto"` detects extensions from recognized,
non-excluded files across all supplied Schedule sources. It does not enable
GTFS-Realtime from Schedule files. Use this when importing an unfamiliar static GTFS feed;
use an explicit array when reopening a database or maintaining multiple sources.

`new Gtfs()`, export, and GTFS-Realtime refresh require an array, not `"auto"`.
Keep the same database-wide selection when reopening a database, including
extensions used by sources you are not currently importing. An instance's
selection is fixed for its lifetime. Recognized files from disabled extensions
produce a notice and are not imported. See [extensions](../extensions.md) for examples.

## Database

| Option                | Description                                                                                                                                             | Accepted values                                                                             | Default                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `database.client`     | Uses an existing connection instead of opening a SQLite file. Use for PostgreSQL/MySQL or to share a connection with your application. JavaScript only. | Open `better-sqlite3` client, or Kysely client with a SQLite, PostgreSQL, or MySQL adapter. | None.                                                                         |
| `database.durability` | Controls SQLite write protection. `"safe"` is for ordinary use; `"unsafe-bulk"` reduces protection for disposable, fresh imports.                       | `"safe"`, `"unsafe-bulk"`; only with connections opened by node-GTFS.                       | `"safe"`                                                                      |
| `database.path`       | SQLite file to open or create. Use a file path to retain data after closing, or `":memory:"` for temporary analysis in one instance.                    | Non-empty filesystem path or `":memory:"`.                                                  | `":memory:"`; standalone Schedule import requires an explicit path or client. |

Use either `path` or `client`, not both. See [database setup](../databases.md)
for connection examples and durability precautions.

A path opens SQLite. A supplied client determines the database type: an open
`better-sqlite3` connection, or Kysely with a SQLite, PostgreSQL, or MySQL adapter.
Other client types and adapters are rejected. `durability` cannot be set with
`client`; configure a borrowed connection before passing it to node-GTFS.

node-GTFS closes connections it opens, not supplied clients. A standalone
import closes its owned connection before returning: explicitly using
`":memory:"` there discards the imported data immediately.

`"unsafe-bulk"` requires no rows in any user table, including unrelated
application tables; empty tables are allowed. A failure or crash can leave
incomplete or unusable data. Use it only when you can discard the database
and import again; do not rely on rollback in this mode.

## Sources

Each source has its own identity; it may contain multiple agencies.

| Option                     | Description                                                                                                     | Accepted values                                      | Default                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| `sources[].sourceId`       | Identifies this source in stored rows and keeps its data separate from other sources without changing GTFS IDs. | Non-empty string, unique across sources.             | `"default"` for one source; required when there are several. |
| `sources[].schedule`       | Supplies the Schedule files and source-specific import settings.                                                | Schedule input object below.                         | None; required for each source in a Schedule import.         |
| `sources[].realtime`       | Groups this source's GTFS-Realtime feeds.                                                                       | Object containing `feeds`.                           | None; required for each source in a GTFS-Realtime refresh.   |
| `sources[].realtime.feeds` | Lists the GTFS-Realtime URLs to fetch for this source. Use separate entries for separate GTFS-Realtime feeds.   | Non-empty array of GTFS-Realtime feed objects below. | Required when `realtime` is supplied.                        |

Use stable source IDs: keep the same ID when importing a static GTFS feed’s next update.
An instance’s `sources` also limits its repository queries and GeoJSON output.

### Schedule input

The following keys belong inside `sources[].schedule`:

| Option            | Description                                                                                                                                                                      | Accepted values                                                                 | Default                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| `defaultAgencyId` | Fills empty agency IDs. Use when a static GTFS feed omits them and you need a specific ID; an ID supplied by a single agency in `agency.txt` takes precedence over this setting. | Non-empty string.                                                               | None; no configured backfill.                      |
| `excludeFiles`    | Skips named files during import. Use to omit data you do not need, such as shape geometry; dependent queries may then be incomplete.                                             | Array of recognized filenames including suffixes, for example `["shapes.txt"]`. | `[]`                                               |
| `import`          | Controls parsing, validation, and handling of existing data or failures for this source.                                                                                         | Import policy object below.                                                     | Child defaults below.                              |
| `path`            | Reads a local static GTFS feed, without downloading it.                                                                                                                          | Non-empty path to a ZIP file or static GTFS feed directory.                     | None; exactly one of `path` and `url` is required. |
| `requestHeaders`  | Adds HTTP request headers. Use for an API key or an `Authorization` token required by the provider.                                                                              | Object of string header values; only with `url`.                                | `{}`                                               |
| `timeoutMs`       | Maximum download time, including redirects and the response body. Increase for large static GTFS feeds or slow connections.                                                      | Positive safe integer in milliseconds; only with `url`.                         | `120000` (2 minutes).                              |
| `url`             | Downloads a Schedule ZIP before importing it.                                                                                                                                    | HTTP(S) URL.                                                                    | None; exactly one of `path` and `url` is required. |

`requestHeaders` are removed after any cross-origin redirect. See the
[download and redirect rules](../import.md#choose-an-input).

### Schedule import policy

These keys belong inside `sources[].schedule.import`:

| Option           | Description                                                                                                                                                                                                                                   | Accepted values                   | Default               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------- |
| `archive`        | Limits ZIP download size and extraction to protect against unexpectedly large archives.                                                                                                                                                       | Archive limits object below.      | Child defaults below. |
| `csv`            | Controls how text files are read. Override only when a static GTFS feed needs nonstandard CSV settings.                                                                                                                                       | CSV settings object below.        | Child defaults below. |
| `onExistingData` | `"replace-source"` replaces this source's Schedule data and clears its GTFS-Realtime data/history, keeping other sources. `"reject"` stops if the source already has Schedule data. Use `"reject"` to protect against accidental replacement. | `"replace-source"`, `"reject"`.   | `"replace-source"`    |
| `onSourceError`  | `"abort"` stops the import when this source fails; `"continue"` records the failure and attempts later sources. Use `"continue"` to process independent static GTFS feeds despite one failing.                                                | `"abort"`, `"continue"`.          | `"abort"`             |
| `validation`     | Controls GTFS checks and policies for unknown fields and duplicate keys.                                                                                                                                                                      | Validation settings object below. | Child defaults below. |

Policies apply separately to each Schedule source. Sources are not imported
as one all-or-nothing operation: earlier successful imports remain if a later
source fails. Normally, a failed replacement restores that source's previous
Schedule and GTFS-Realtime data; `"unsafe-bulk"` does not provide that protection.
Strict validation rejects invalid sources before replacement. See
[import behavior](../import.md) for examples.

### Archive limits

These keys belong inside `sources[].schedule.import.archive`. They apply to
local and downloaded ZIPs, not an already-extracted static GTFS feed directory. Exceeding
a limit fails the source. Increase a limit only for a trusted static GTFS feed that needs it.

| Option                   | Description                                                                  | Accepted values                 | Default               |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------------------- | --------------------- |
| `maxCompressedBytes`     | Maximum size of the ZIP before extraction.                                   | Positive safe integer in bytes. | `1073741824` (1 GiB). |
| `maxEntries`             | Maximum number of ZIP entries, including files and directories.              | Positive safe integer.          | `1000`                |
| `maxExtractedFileBytes`  | Maximum uncompressed size of any one file, such as a large `stop_times.txt`. | Positive safe integer in bytes. | `4294967296` (4 GiB). |
| `maxExtractedTotalBytes` | Maximum combined uncompressed size of files in the archive.                  | Positive safe integer in bytes. | `8589934592` (8 GiB). |

### Validation settings

These keys belong inside `sources[].schedule.import.validation`.

| Option           | Description                                                                                                                                                                                                                                | Accepted values                        | Default      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ------------ |
| `mode`           | Controls GTFS rule checking and whether validation errors reject the source. Choose a mode using the table below.                                                                                                                          | `"off"`, `"strict"`, `"permissive"`.   | `"off"`      |
| `onDuplicateKey` | `"reject"` treats repeated keys as errors; `"keep-first"` retains the first row and reports later duplicates. Use `"keep-first"` when losing later rows is acceptable.                                                                     | `"reject"`, `"keep-first"`.            | `"reject"`   |
| `onUnknownField` | `"preserve"` stores unrecognized fields in the `_unknown_fields` JSON database column and restores them on export; `"reject"` reports them as errors; `"discard"` drops their values. Use `"preserve"` to retain provider-specific fields. | `"preserve"`, `"reject"`, `"discard"`. | `"preserve"` |

| Mode           | Behavior / when to use it                                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"off"`        | Imports without checking GTFS completeness or relationships. Use for analysis when you do not need validation. Parsing, normalization, and database constraints still apply; unrepresentable values fail the source. |
| `"strict"`     | Checks supported GTFS rules and rejects the source for error-severity notices, but not warnings. Use to check a static GTFS feed before replacing existing data.                                                     |
| `"permissive"` | Runs the same checks as strict mode, reports problems, and skips rows that cannot be stored. Use to salvage usable records from an imperfect static GTFS feed.                                                       |

Unknown-field and duplicate-key policies apply even with validation off.
With `onUnknownField: "reject"`, off and strict modes reject the source;
permissive mode reports the problem and imports without preserving those
unknown fields. `onDuplicateKey: "reject"` can still fail on database
uniqueness constraints in permissive mode; choose `"keep-first"` to skip
duplicates. Duplicate keys include rows with different non-key values,
not just identical copies.

Malformed archives, malformed CSV, and database failures can fail an import
in any mode. `_unknown_fields` is not included in normal repository results;
use direct database queries to read it. See [validation](../validation.md) for
examples and interpreting notices.

### CSV options

Configure these at `sources[].schedule.import.csv`:

| Option           | Description                                                                                                                                                         | Accepted values                    | Default             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------- |
| `delimiter`      | Separates fields in a record. Change for a static GTFS feed using semicolons or tabs instead of commas.                                                             | One character.                     | `","`               |
| `encoding`       | Converts file bytes to text. Change when a static GTFS feed uses UTF-16LE or Latin-1 rather than UTF-8.                                                             | `"utf8"`, `"utf16le"`, `"latin1"`. | `"utf8"`            |
| `escape`         | Marks a literal quote inside a quoted field; the default reads doubled quotes (`""`) as one quote. Change only to match the static GTFS feed's escaping convention. | One character.                     | Double quote (`"`). |
| `quote`          | Encloses values containing delimiters or line breaks. `false` disables quoted-field handling.                                                                       | One character or `false`.          | Double quote (`"`). |
| `relaxQuotes`    | Allows quote characters inside otherwise unquoted fields. Set `false` to reject this nonstandard quoting.                                                           | Boolean.                           | `true`              |
| `skipEmptyLines` | Ignores empty lines instead of treating them as records.                                                                                                            | Boolean.                           | `true`              |
| `trim`           | Removes surrounding whitespace from unquoted values; quoted contents are preserved. Set `false` when unquoted surrounding spaces must be retained.                  | Boolean.                           | `true`              |

UTF-8 and UTF-16LE byte-order marks (BOMs) are always recognized and take
precedence over the configured encoding. Delimiter and quote must differ.
Character options cannot be a line break or NUL and must be representable
in the selected encoding.
Line endings are detected automatically.
Rows must have the same number of fields as the header. CSV callbacks and
partial-file parsing are not supported; preprocess such files before import.

## GTFS-Realtime feeds and retention

Each entry in `sources[].realtime.feeds` accepts:

| Option             | Description                                                                                                                                                                                           | Accepted values                                                                                             | Default                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `feedId`           | Stable identity used to keep this GTFS-Realtime feed's current records and history separate. Supply it when one source has multiple GTFS-Realtime feeds of the same type, or when omitting `type`.    | Non-empty string, unique within its source.                                                                 | The `type` value; required if `type` is omitted. |
| `maxDownloadBytes` | Maximum response size after HTTP decompression. Increase only for a trusted GTFS-Realtime feed whose response exceeds the limit.                                                                      | Positive safe integer in bytes.                                                                             | `67108864` (64 MiB).                             |
| `requestHeaders`   | Adds HTTP request headers, such as an API key or an `Authorization` token.                                                                                                                            | Object of string header values.                                                                             | `{}`                                             |
| `timeoutMs`        | Maximum time for each complete download attempt, including redirects and the response body. Increase for slow GTFS-Realtime feeds.                                                                    | Positive safe integer in milliseconds.                                                                      | `30000` (30 seconds).                            |
| `type`             | Declares the GTFS-Realtime feed's overall content type and supplies its default identity. Use `"mixed"` for combined GTFS-Realtime messages, or omit with an explicit `feedId` to infer content type. | `"alerts"`, `"tripUpdates"`, `"vehiclePositions"`, `"shapes"`, `"stops"`, `"tripModifications"`, `"mixed"`. | None declared; required if `feedId` is omitted.  |
| `url`              | Endpoint from which to download GTFS-Realtime protobuf data.                                                                                                                                          | HTTP(S) URL.                                                                                                | Required.                                        |

Declare `type` only when it describes the whole GTFS-Realtime feed. A GTFS-Realtime message can contain
several entity kinds: TripUpdates messages can also contain Shape and Stop
entities, so those do not require separate URLs. `type` is not an entity
filter. See [GTFS-Realtime feed types](../realtime.md#choose-a-gtfs-realtime-feed-identity).

GTFS-Realtime downloads remove custom `requestHeaders` after a cross-origin
redirect, just like Schedule downloads. See the
[redirect rules](../import.md#choose-an-input).

### Retention

| Option                                      | Description                                                                                                                                                                         | Accepted values                                  | Default               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------- |
| `realtime.retention`                        | Sets expiration for current GTFS-Realtime data and stored message history.                                                                                                          | Retention settings object.                       | Child defaults below. |
| `realtime.retention.currentEntitiesSeconds` | Seconds after fetching until current records become eligible for cleanup. Increase to tolerate a longer gap between refreshes; `0` makes records immediately eligible.              | Non-negative safe integer in seconds.            | `30`                  |
| `realtime.retention.snapshotsSeconds`       | Seconds to retain snapshot history after fetching. Increase for historical analysis; `0` makes history immediately eligible for cleanup, and `null` disables time-based expiration. | Non-negative safe integer in seconds, or `null`. | `86400` (1 day).      |

Both numeric durations must be non-negative safe integers (whole seconds).
The fetch timestamp plus the duration must also be a safe integer; otherwise
refresh rejects with `GTFS_CONFIG_INVALID` before writing the GTFS-Realtime data.
These settings mark expiration; they do not schedule refreshes or delete rows.
Call `await gtfs.realtime.cleanup()` periodically to remove expired data.
Unlimited history can keep growing until you remove it. See
[cleanup](../realtime.md#expiration-and-cleanup) for examples.

## Export and reporting

| Option                   | Description                                                                                                                                                                                                                                  | Accepted values                                                                             | Default                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `export.batchSize`       | Requested number of rows per database read batch; it does not split output files. For PostgreSQL, smaller batches reduce per-batch memory and larger ones can reduce read overhead. SQLite and MySQL stream rows without using this setting. | Positive safe integer.                                                                      | `1000`                                                                                                        |
| `export.outputDirectory` | Folder in which to write the exported GTFS files. Set a dedicated folder when another application needs a predictable destination.                                                                                                           | Non-empty directory path.                                                                   | `./gtfs-export/<agency-name>-<source-hash>`; the agency name is sanitized and the hash identifies the source. |
| `export.overwrite`       | Allows replacing an existing destination after the new export is generated successfully. Use to refresh a dedicated export folder.                                                                                                           | Boolean.                                                                                    | `false`                                                                                                       |
| `export.sourceId`        | Selects the single source to export, including all agencies within that source. Set when the database or instance contains multiple sources.                                                                                                 | Non-empty source ID present in the database and within the instance's source scope, if set. | Selected automatically only when unambiguous; otherwise export fails.                                         |
| `reporting.level`        | Filters delivered messages: `"silent"` sends none, `"error"` errors only, `"warn"` warnings and errors, and `"info"` adds progress/status. Reduce for quieter scripts.                                                                       | `"silent"`, `"error"`, `"warn"`, `"info"`.                                                  | `"info"` with a reporter; otherwise `"silent"`. The CLI supplies a reporter.                                  |
| `reporting.reporter`     | Receives progress and diagnostic events. Use `createConsoleReporter()` for terminal output or a callback to connect your logger. JavaScript only.                                                                                            | Synchronous `(event: GtfsReportEvent) => void` callback.                                    | None in JavaScript; the CLI supplies console reporting to stderr.                                             |

Export refuses existing
destinations unless `overwrite` is `true`; replacement happens only after the
new files are generated. A successful replacement removes the **entire old
directory, including unrelated files**. Use a dedicated export folder, not
your input static GTFS feed or a folder containing other work. Failed generation leaves
the previous destination untouched. Read
[export safety](../export.md#choose-a-safe-output-directory) for recovery details.

Setting a reporting level does not create a reporter in JavaScript, and filtering
messages does not change returned validation counts or samples. Reporter
callbacks are not awaited; keep them quick and avoid throwing. See
[reporting](../reporting.md) for callback and console examples.

Import and GTFS-Realtime refresh automatically ensure compatible tables exist.
Use the [schema methods](../databases.md#manage-tables) to check or explicitly rebuild tables.

The schema always includes `_unknown_fields` and generated columns for time
comparisons, case-insensitive queries, and storage keys. Each source's
`validation.onUnknownField` policy controls whether unknown values are stored.

## Instance operation options

Connection ownership, enabled extensions, and source scope belong to `new Gtfs()`.
Import, export, and refresh can take a named options object without opening a new
instance. No-argument calls continue to use configured defaults.

| Operation option                | Accepted value                                                       | When omitted                                             |
| ------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| `import.sources`                | Nonempty array of `{ sourceId, schedule }`                           | Configured sources with Schedule inputs                  |
| `import.validation`             | `mode`, `onUnknownField`, `onDuplicateKey` as in Schedule validation | Each selected source's validation policy                 |
| `realtime.refresh.sources`      | Nonempty array of `{ sourceId, realtime: { feeds } }`                | Configured sources with GTFS-Realtime inputs             |
| `realtime.refresh.retention`    | `currentEntitiesSeconds` and/or `snapshotsSeconds`                   | Instance GTFS-Realtime retention fields                  |
| `export.sourceId`               | Source identity string                                               | Instance export selection, or the instance's sole source |
| `export.outputDirectory`        | Output path string                                                   | Instance export directory, then the automatic directory  |
| `export.overwrite`              | Boolean                                                              | Instance setting, default `false`                        |
| `export.batchSize`              | Positive safe integer                                                | Instance setting, default `1000`                         |
| `reporting` on these operations | `{ reporter?, level? }`                                              | Instance reporting configuration                         |
| `signal` on these operations    | `AbortSignal`                                                        | No caller cancellation                                   |

Use per-call sources for a new download or GTFS-Realtime feed. A supplied source list
replaces the operation's default list. Each entry requires an explicit identity
and complete input settings; headers, GTFS-Realtime feeds, and source-specific policies
from the replaced list are not merged. Import validation and refresh retention
override only their specified fields. Export fields override individually.
Per-call reporting replaces both reporter and level; `{}` disables reporting,
and a reporter without a level uses `info`.
Use [`signal` to cancel an operation](../cancellation.md). It is not an instance
default and is not accepted in JSON configuration.

All options are captured when the method is called, including while waiting for
another operation. No call changes future defaults. Unknown options, explicit
undefined options, and attempts to replace the database or extensions reject.

A scoped instance accepts only identities in its configured `sources`. Operations
may select fewer sources but cannot add identities to that scope. An unscoped
instance can operate on any explicitly named source. Multi-source scoped exports
require a source selection. These rules apply to library operations; arbitrary
SQL inside `database.withKysely()` remains explicitly caller-scoped.

See [import inputs](../import.md#choose-inputs-per-call), [export](../export.md#javascript),
and [GTFS-Realtime refresh](../realtime.md#configure-and-refresh) for examples.

## Next steps

- [Choose and customize a sample configuration](../configuration.md).
- [Set up your database connection](../databases.md).
- [Choose validation policies](../validation.md).
- [Configure GTFS-Realtime refreshes](../realtime.md).
- [Investigate configuration errors](../troubleshooting.md#my-configuration-is-rejected).
