# Extensions

[All guides](README.md)

An extension adds transit data beyond the core Schedule files. Enable only
the formats your application needs. Core GTFS Schedule is always enabled;
optional extensions are disabled by default.

| Config value    | Repository group  | Data                                                           |
| --------------- | ----------------- | -------------------------------------------------------------- |
| `gtfs-realtime` | `gtfs.realtime`   | Live updates and their history.                                |
| `gtfs-plus`     | `gtfs.gtfsPlus`   | Additional calendar, direction, route, and stop attributes.    |
| `gtfs-ride`     | `gtfs.gtfsRide`   | Ridership and capacity records.                                |
| `gtfs-to-html`  | `gtfs.gtfsToHtml` | Timetable presentation settings and notes.                     |
| `tods`          | `gtfs.tods`       | Transit operations and Schedule supplements.                   |
| `tides`         | `gtfs.tides`      | Operational observations, vehicles, and passenger/fare events. |

See the [file and repository catalog](data-model.md#files-and-repositories) for
the supported files in each group.

## Enable explicitly

```js
import { Gtfs } from 'gtfs';

const gtfs = new Gtfs({
  database: { path: './transit.sqlite' },
  extensions: ['gtfs-plus', 'tides'],
  sources: [{ schedule: { path: './feed.zip' } }],
});

try {
  await gtfs.import();
  const directions = await gtfs.gtfsPlus.directions.all();
  console.table(directions);
} finally {
  await gtfs.close();
}
```

The selected set applies to schema management, import, export, and queries.
It is fixed for the lifetime of an instance. Use the same database-wide set
when reopening the database, including extensions used by other sources.
Do not put `gtfs-schedule` in the array; it is already enabled.

Only enabled extensions’ tables and indexes are created or validated.
Recognized files from disabled extensions produce one notice per extension
and source, listing the files not imported.

## Detect extensions during Schedule import

For a standalone import or the import CLI, use:

```json
{
  "database": { "path": "./transit.sqlite" },
  "extensions": "auto",
  "sources": [
    { "sourceId": "north", "schedule": { "path": "./north.zip" } },
    { "sourceId": "south", "schedule": { "path": "./south.zip" } }
  ]
}
```

Pass this to `importGtfs(config)` or run `gtfs import --config ./config.json`.
Detection inspects recognized, non-excluded files from all prepared Schedule
sources and enables their combined extension set before importing them.
It does not fetch GTFS-Realtime feeds or enable GTFS-Realtime from Schedule files.

`"auto"` is not accepted by `new Gtfs()`, export, or GTFS-Realtime refresh. For
ongoing multi-source databases, prefer an explicit list: one later import
cannot discover the extensions needed by sources that were not supplied to it.

## Disabled, empty, and missing are different

Repository names remain available for autocomplete regardless of configuration.
Calling one has these outcomes:

| State                                 | Result                                               |
| ------------------------------------- | ---------------------------------------------------- |
| Extension disabled                    | `GTFS_EXTENSION_DISABLED` before querying its table. |
| Enabled table, no matching rows       | `[]`, `null`, or an aggregate count of `0`.          |
| Enabled table missing or incompatible | `GTFS_SCHEMA_INVALID`.                               |

An extension-disabled error includes `table`, `extension`, and
`enabledExtensions` in its details. Enable an extension and run
`gtfs.schema.ensure()` to create its missing tables; importing fills them.
Enabling an extension alone does not recover files skipped by an earlier import.

## Next steps

- [Look up supported files and repositories](data-model.md#files-and-repositories).
- [Import your selected files](import.md#choose-files-and-extensions).
- [Query extension repositories](queries.md).
- [Export enabled extension files](export.md#which-data-is-exported).
- [Configure GTFS-Realtime](realtime.md).
