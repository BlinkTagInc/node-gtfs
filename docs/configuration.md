# Configure node-GTFS

[All guides](README.md)

A configuration describes where your data comes from and where it should be
stored. Most users need only a database path and one Schedule source.

For every option's accepted values and defaults, see the
[configuration reference](reference/configuration.md).

## A small config file

Save this as `config.json`:

```json
{
  "database": { "path": "./transit.sqlite" },
  "sources": [{ "schedule": { "path": "./feed.zip" } }]
}
```

Then run `gtfs import --config ./config.json`. Relative paths are relative to
the terminal’s current folder, not the folder containing the config file.

JavaScript accepts the same structure, with additional support for database
clients and reporter functions. Unknown configuration keys are rejected.

## Sample configuration files

You can start with the small example above or copy one of these templates:

| Sample                                                        | What it includes                                                                         |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [config-sample.json](../config-sample.json)                   | A local Schedule ZIP and three GTFS-Realtime feeds, using SQLite.                        |
| [config-sample-realtime.json](../config-sample-realtime.json) | GTFS-Realtime-only setup with authentication, a request timeout, and retention settings. |
| [config-sample-full.json](../config-sample-full.json)         | Multiple sources, download and import settings, GTFS-Realtime, and export settings.      |

Open a sample and copy its JSON into a new `config.json` in your working
folder. Replace the example paths, URLs, and tokens with your own, and remove
settings you do not need. For Schedule-only use, remove each source’s
`realtime` section and remove `"gtfs-realtime"` from `extensions`.

The full sample illustrates optional choices, not just defaults—for example,
it excludes `shapes.txt` from one source. Review it before importing.

Run the command for the data you configured:

```sh
gtfs import --config ./config.json
```

For GTFS-Realtime, use `gtfs realtime refresh --config ./config.json` instead.
The CLI also finds `config.json` automatically in your current folder, so
you can omit `--config` when using that filename. Sample filenames are not
loaded automatically.

All three samples are included in the npm package. With a local
`npm install gtfs`, you can also find them in `node_modules/gtfs/`.

## A more detailed example

This example keeps the normal source-replacement behavior, retains the first
row for duplicate keys, and enables GTFS-Realtime:

```json
{
  "database": { "path": "./transit.sqlite" },
  "extensions": ["gtfs-realtime"],
  "sources": [
    {
      "sourceId": "metro",
      "schedule": {
        "url": "https://example.com/gtfs.zip",
        "timeoutMs": 60000,
        "import": {
          "validation": { "onDuplicateKey": "keep-first" }
        }
      },
      "realtime": {
        "feeds": [
          { "type": "alerts", "url": "https://example.com/alerts.pb" },
          { "type": "tripUpdates", "url": "https://example.com/trips.pb" },
          {
            "type": "vehiclePositions",
            "url": "https://example.com/vehicles.pb"
          }
        ]
      }
    }
  ],
  "realtime": {
    "retention": { "currentEntitiesSeconds": 30, "snapshotsSeconds": 86400 }
  },
  "export": { "outputDirectory": "./exported-feed" },
  "reporting": { "level": "info" }
}
```

Replace the example URLs. The CLI supplies a console reporter. JavaScript
programs must supply a reporter to receive logs.

## Instance operation options

An instance keeps its database connection, enabled extensions, and source scope
for its lifetime. Calls to `gtfs.import()`, `gtfs.export()`, and
`gtfs.realtime.refresh()` use its configured defaults. Pass an options object to
change one operation without changing future defaults.

Overrides depend on the setting: a source list replaces the complete input list,
validation and retention merge specified fields, export settings override
individually, and reporting replaces both the reporter and level. A scoped
instance can select fewer sources, but cannot add source identities.

See the [operation option reference](reference/configuration.md#instance-operation-options)
for accepted options and exact replacement rules. The
[import](import.md#choose-inputs-per-call), [export](export.md#javascript), and
[GTFS-Realtime](realtime.md#configure-and-refresh) guides show per-call examples.

## Next steps

- [Look up all configuration options and defaults](reference/configuration.md).
- [Use your configuration from the command line](cli.md).
- [Set up SQLite, PostgreSQL, or MySQL](databases.md).
- [Import and update your static GTFS feed](import.md).
- [Refresh GTFS-Realtime feeds](realtime.md).
- [Export a source to GTFS files](export.md).
- [Investigate configuration errors](troubleshooting.md#my-configuration-is-rejected).
