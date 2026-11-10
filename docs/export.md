# Export data

[All guides](README.md)

Export writes one source back to a directory of GTFS files. It works with
SQLite, PostgreSQL, and MySQL, including enabled file-based extensions and
`locations.geojson`. It does not export GTFS-Realtime protobuf messages or create a ZIP.

**Export refuses to overwrite an existing directory by default.** Use a new
destination, or explicitly enable replacement for a dedicated export folder.
See [output directory safety](#choose-a-safe-output-directory).

## Command line

```sh
gtfs export --database ./transit.sqlite --output ./exported-feed
```

If the database contains multiple sources, choose one:

```sh
gtfs export --config ./config.json --source-id metro --output ./exported-metro
```

Use a configuration file with the appropriate `extensions` array to include
optional formats. See [CLI options](cli.md).

## JavaScript

```js
import { exportGtfs } from 'gtfs';

const result = await exportGtfs({
  database: { path: './transit.sqlite' },
  export: {
    outputDirectory: './exported-feed',
    sourceId: 'default',
  },
});

console.log(`Wrote ${result.files.length} files to ${result.outputDirectory}`);
console.table(result.files);
```

With an open instance:

```js
const result = await gtfs.export({ outputDirectory: './exported-feed' });
```

Instance overrides accept `batchSize`, `outputDirectory`, `overwrite`, `sourceId`,
and `reporting`. Per-call export fields override the corresponding instance
`export` settings. Reporting replaces the complete reporting configuration.

Choose a source with `gtfs.export({ sourceId: 'metro', ... })`, set an instance
`export.sourceId` default, or scope the instance to one source. A multi-source
instance requires an explicit selection, even if only one source currently has
data. The selected source must be within instance scope. An unscoped instance
can omit the selection when the database contains exactly one source.

## What the result contains

Both functions return `Promise<GtfsExportResult>`:

| Property          | Meaning                                                         |
| ----------------- | --------------------------------------------------------------- |
| `sourceId`        | Exported source identity.                                       |
| `outputDirectory` | Resolved absolute output path.                                  |
| `files`           | Files actually written, each with `filename` and `recordCount`. |
| `durationMs`      | Elapsed export time in milliseconds.                            |

`recordCount` excludes CSV headers. For `locations.geojson`, it counts
features. Empty tables are omitted, so they do not appear in `files`.
A successful return means export finished; failures throw `GtfsError`.

## Choose a safe output directory

`export.overwrite` defaults to `false`. An existing destination, including an
empty directory, causes `GTFS_EXPORT_OUTPUT_EXISTS` without changing its contents.

To replace a previous export, set:

```json
{
  "export": {
    "outputDirectory": "./exports/feed",
    "overwrite": true
  }
}
```

Or call `await gtfs.export({ overwrite: true })` with an open instance.

Replacement files are generated separately. Once generation succeeds, the
**entire destination directory is replaced, including unrelated files and
subdirectories**. Use a dedicated export folder, never your original static GTFS feed or
another folder containing work you want to keep. Symbolic-link destinations,
files, your home directory, and working-directory ancestors cannot be replaced.

Without an explicit destination, export uses
`./gtfs-export/<agency-name>-<source-hash>`. The agency name is sanitized and
shortened, with `feed` used if no usable name remains. A stable hash of the
source ID keeps different sources separate, even when agency names match.
`result.outputDirectory` tells you the exact resolved path.

Database/source checks happen before writing. If generation fails, existing
output is left untouched and incomplete new files are removed. If cleanup fails,
the error includes `error.details.partialOutputDirectory` for locating the
remaining incomplete output.

If installing a replacement fails, export attempts to restore the previous
directory. If the filesystem also prevents restoration, the error includes
`error.details.recoveryDirectory`, where the previous output is retained.
Replacement temporarily needs space for both exports. Do not publish or
consume incomplete output as a complete static GTFS feed.

## Which data is exported?

Export includes populated, enabled file-backed tables for the selected source.
Disabled extension tables can be absent. Missing enabled tables cause
`GTFS_SCHEMA_INVALID`; they are not treated as empty.

All agencies belonging to that source are exported together. Multiple agencies
produce a warning, not one output directory per agency.

Values are exported from the normalized database, not copied from the original
download. Quoting, header order, row order, and formatting may differ. Unknown
fields preserved during import are restored as file fields. Database-only
columns such as `source_id`, generated time values, and `_unknown_fields` itself
are not added as GTFS columns. Monetary amounts are written as decimal values.

## Large exports

`export.batchSize` is the positive number of rows read per batch (default
`1000`). It does not split files. PostgreSQL needs the
[cursor-enabled connection](databases.md#postgresql) used for streaming.

To produce other formats, query the records you need and write them with your
application’s format-specific tools. For maps, start with [GeoJSON](geojson.md).

## Next steps

- [Make GeoJSON for maps](geojson.md).
- [Include optional extension files](extensions.md).
- [Understand source, stored, and returned values](data-model.md#row-representations).
- [Reimport exported files](import.md).
- [Troubleshoot incomplete exports](troubleshooting.md#export-is-incomplete-or-files-disappeared).
