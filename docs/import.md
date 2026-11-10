# Import Schedule data

[All guides](README.md)

Import accepts a downloaded ZIP, an HTTP(S) ZIP URL, or a directory containing
GTFS files. It stores Schedule records and enabled extensions in your database.

For PostgreSQL or MySQL, follow [database setup](databases.md) first, then
use the JavaScript API. The CLI uses SQLite.

## Command line

Import a ZIP into a local SQLite database:

```sh
gtfs import --input ./feed.zip --database ./transit.sqlite
```

Replace `feed.zip` with your filename. To save reusable settings, start with
a [sample configuration](configuration.md#sample-configuration-files) and run
`gtfs import --config ./config.json`. See [CLI options](cli.md#import-schedule-data)
for URL inputs and other flags.

## Import once from JavaScript

```js
import { importGtfs, createConsoleReporter } from 'gtfs';

const result = await importGtfs({
  database: { path: './transit.sqlite' },
  sources: [{ schedule: { path: './feed.zip' } }],
  reporting: { reporter: createConsoleReporter() },
});

console.log(result.success);
console.table(result.sources[0]?.files);
console.log(result.validation.countsByCode);
```

`importGtfs()` requires an explicit SQLite `database.path` or a caller-owned
`database.client`. It closes connections it opens, but leaves supplied clients open.
Use a file path to keep the imported data. Explicit `path: ":memory:"` is allowed,
but that database disappears before the function returns.

To import and query in memory, use [an instance](getting-started.md#import-and-query-in-one-script)
and call `gtfs.import()` instead. Instances still default to an in-memory database.

## Choose inputs per call

Keep a database open while importing successive downloads:

```js
import { Gtfs } from 'gtfs';

const gtfs = new Gtfs({
  database: { path: './transit.sqlite' },
  sources: [{ sourceId: 'metro' }],
});
try {
  await gtfs.import({
    sources: [{ sourceId: 'metro', schedule: { path: './latest-feed.zip' } }],
    validation: { mode: 'strict' },
  });
} finally {
  await gtfs.close();
}
```

Omit `sources` to use the instance's configured Schedule inputs. A supplied list
replaces those inputs for that call; each entry needs an explicit `sourceId` and
a complete `schedule` object. Source-specific headers and import policies are
not inherited from a replaced input. The top-level `validation` option overrides
only the specified validation fields on every selected source.

Per-call `reporting` replaces the instance reporter and level for that call.
Options are captured when called and never change instance defaults. See
[operation defaults and scope](reference/configuration.md#instance-operation-options).

## Choose an input

Use one of these `schedule` objects in a source:

```json
{ "path": "./downloaded-feed.zip" }
```

```json
{ "path": "./unpacked-feed" }
```

```json
{
  "url": "https://example.com/gtfs.zip",
  "requestHeaders": { "Authorization": "Bearer YOUR_TOKEN" },
  "timeoutMs": 60000
}
```

Keep credentials out of shared config files and issue reports. For JavaScript,
you can obtain tokens from environment variables.

Configured `requestHeaders` are kept on same-origin redirects (the same protocol,
hostname, and port). If any redirect changes origin, all configured headers are
removed for the rest of that download. If the destination needs authentication,
configure its trusted URL directly. HTTPS-to-HTTP redirects are rejected.
Downloads allow up to 20 redirects, all within the source's `timeoutMs`.

A ZIP may put its static GTFS feed in one nested directory. Archives containing several
possible static GTFS feed directories are rejected; import those as separate sources.
Archive paths cannot escape the extraction directory.

### Input size limits

ZIP imports have default limits of 1 GiB compressed, 1,000 entries, 4 GiB per
extracted file, and 8 GiB total extracted data. These include files that will
not be imported. Downloads stream to temporary storage, and limits are checked
against actual bytes as well as declared sizes. HTTP decompression counts toward
the compressed ZIP size limit. These archive limits do not apply to an already
unpacked local directory.

For a trusted large static GTFS feed, raise only the limits it needs in
`sources[].schedule.import.archive`, for example:

```json
{
  "schedule": {
    "path": "./large-feed.zip",
    "import": {
      "archive": {
        "maxCompressedBytes": 2147483648,
        "maxExtractedFileBytes": 8589934592,
        "maxExtractedTotalBytes": 17179869184
      }
    }
  }
}
```

Limit failures use `GTFS_DOWNLOAD_TOO_LARGE` or `GTFS_ZIP_LIMIT_EXCEEDED`.
Temporary source files are removed and existing source data is unchanged.
See [all archive settings](reference/configuration.md#archive-limits).

## Replace an updated static GTFS feed

Keep `sourceId` stable and import the new ZIP or URL. With the defaults,
node-GTFS prepares the input, deletes that source’s existing records from
enabled file-backed tables, and writes the replacement in one source transaction.

Static GTFS feed validation is off by default. Enable it with
`sources[].schedule.import.validation.mode: "strict"` to check GTFS rules
before replacing data. See [validation modes](validation.md).

- Other sources are kept.
- Files absent from the replacement do not leave that source’s old rows behind.
- Excluded files are not reimported; replacement still removes their existing
  rows in enabled tables.
- GTFS-Realtime current records and snapshot history for that source are cleared,
  even when GTFS-Realtime is not enabled in the import configuration. A failed
  replacement restores both Schedule and GTFS-Realtime data.
- A GTFS-Realtime refresh that fetched against the previous Schedule cannot write
  after replacement; it fails with `GTFS_REALTIME_SCHEDULE_CHANGED`. Refresh
  again to fetch current data.
- A failed source transaction restores its previous rows. Strict validation
  rejection happens before source deletion.

To stop when data already exists instead:

```json
{
  "schedule": {
    "path": "./feed.zip",
    "import": { "onExistingData": "reject" }
  }
}
```

Imports reuse compatible tables and create missing tables. To deliberately
rebuild all enabled tables, use [`gtfs.schema.recreate()`](databases.md#manage-tables).
This deletes their data for every source; it is not needed for routine updates.

## Use more than one source

```js
import { importGtfs } from 'gtfs';

await importGtfs({
  database: { path: './region.sqlite' },
  sources: [
    { sourceId: 'city-bus', schedule: { path: './bus.zip' } },
    { sourceId: 'regional-rail', schedule: { path: './rail.zip' } },
  ],
});
```

Every source needs a unique explicit `sourceId` when there are several.
The value appears as `source_id` on returned rows. A static GTFS feed may itself contain
several agencies; `agency_id` and `source_id` are different concepts.

Two sources can both have a route called `1`. Its `route_id` stays `1`; the
source ID distinguishes the records. Built-in relationships keep those sources
separate. Include `source_id` yourself when writing direct SQL joins.

Sources are imported separately, not as one all-or-nothing operation. If a
later source fails, earlier successful imports remain. To attempt later sources
after a particular source fails, set that source’s `schedule.import.onSourceError`
to `"continue"` and check the returned result.

Cancellation and errors with `details.databaseRecoveryRequired === true` always
stop the import, including when `onSourceError` is `"continue"`. This flag covers
failed rollback or cleanup and an unconfirmed transaction boundary. Inspect the
database before retrying: writes may already have committed. When using a
caller-owned transaction, let the error escape its callback so the caller rolls
back instead of committing partial work. See [error recovery](reporting.md#catch-an-error).

## Choose files and extensions

`schedule.excludeFiles` takes exact filenames such as `"shapes.txt"`, not
repository names. Excluding files can make the resulting data incomplete for
queries or export.

Shapes are required for continuous-stop service. Excluding `shapes.txt` also
skips the [continuous-stop geometry checks](validation.md#shapes-for-continuous-stop-service).

Optional formats require [extension selection](extensions.md). A recognized
disabled extension produces one notice per source/extension listing the files
that were not imported.

## Speed up imports

Use a local static GTFS feed directory and avoid work your application does not need.
Most of these settings already match the defaults:

| Option                                      | Setting                               | Effect                                                                                                 |
| ------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `sources[].schedule.path`                   | An extracted local directory          | Avoids downloading and extracting a ZIP during import.                                                 |
| `sources[].schedule.import.validation.mode` | `"off"`                               | Skips GTFS rule validation. Parsing, normalization, and database constraints still apply.              |
| `extensions`                                | `[]`, or only the extensions you need | Avoids creating and importing unused extension tables.                                                 |
| `reporting.level`                           | `"silent"`                            | Disables progress and log output.                                                                      |
| `sources[].schedule.excludeFiles`           | Only files you do not need            | Reduces the data imported. For example, exclude `"shapes.txt"` only if you do not need shape geometry. |

Under `sources[].schedule.import.validation`, keep the defaults
`onDuplicateKey: "reject"` and `onUnknownField: "preserve"`. Changing these
policies is not a performance shortcut; use other values only when your static GTFS feed
or application needs them.

### Disposable SQLite builds

For SQLite connections opened by node-GTFS, `database.durability: "unsafe-bulk"`
can further reduce write overhead. It requires an empty database: no rows in
any user table, including unrelated application tables. Empty tables are allowed.

**Use a new, disposable database path.** With `unsafe-bulk`, a failed import or crash can leave
an unusable database; do not depend on rollback. Rebuild it before use if the
import fails. Keep the default `durability: "safe"`
for routine updates where existing data must be protected.

This example keeps all Schedule files, unknown fields, and generated columns:

```json
{
  "database": {
    "path": "./transit-build.sqlite",
    "durability": "unsafe-bulk"
  },
  "extensions": [],
  "reporting": { "level": "silent" },
  "sources": [
    {
      "schedule": {
        "path": "./extracted-feed",
        "import": {
          "validation": {
            "mode": "off",
            "onDuplicateKey": "reject",
            "onUnknownField": "preserve"
          }
        }
      }
    }
  ]
}
```

Save it as `config.json` and run `gtfs import --config ./config.json`.
See [SQLite durability precautions](databases.md#sqlite) before using this mode.

## Understand the result

Both `importGtfs()` and `gtfs.import()` return `GtfsImportResult`:

| Field                         | Meaning                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `success`                     | Every source completed without an operation error.        |
| `durationMs`                  | Total elapsed time in milliseconds.                       |
| `sources`                     | Source outcomes, in configuration order.                  |
| `errors`                      | Source failures retained when processing continues.       |
| `errorCountsByCode`           | Counts grouped by error code.                             |
| `validation.countsByCode`     | Complete notice counts, grouped by code.                  |
| `validation.countsBySeverity` | Complete counts of `error`, `warn`, and `info` notices.   |
| `validation.samples`          | At most 100 notice examples across the entire operation.  |
| `validation.truncated`        | Whether additional notices were omitted from the samples. |

Each `GtfsImportSourceResult` has `sourceId`, `success`, `durationMs`, `files`,
and an `error` if it failed. Each file is a `GtfsImportFileResult`:

| Field          | Meaning                                                                       |
| -------------- | ----------------------------------------------------------------------------- |
| `filename`     | GTFS filename, including its suffix.                                          |
| `recordsRead`  | CSV data records processed, excluding headers, or GeoJSON features processed. |
| `rowsInserted` | Rows inserted and committed for this source.                                  |
| `rowsSkipped`  | Records discarded as duplicates or because their values could not be stored.  |

Empty and header-only files have zero counts. Missing, excluded, and disabled
files are omitted. A source that fails before reading files has an empty `files`
array. If a source fails partway through, its counts cover only work reached;
rolled-back inserts are reported as zero. Those records are not counted as
skipped, so the counts need not add up for a failed source.

Notice counts include all findings, regardless of reporting level. Samples are
not a complete list and may not include every code or severity. To receive every
notice, use [reporting events or a diagnostic file](reporting.md#save-every-validation-notice).

A successful import is not necessarily a warning-free static GTFS feed. By default source
failures throw; use `try`/`catch` as shown in [reporting and errors](reporting.md).
With `onSourceError: "continue"`, failed and successful sources are both included
in the returned result. `permissive` validation can report errors or skip rows
while the source import still succeeds.

## Next steps

- [Find routes, stops, and trips](queries.md).
- [Understand validation notices](validation.md).
- [Include optional extension files](extensions.md).
- [Add GTFS-Realtime updates to your Schedule data](realtime.md).
- [Export GTFS files](export.md).
- [Track progress and handle import failures](reporting.md).
