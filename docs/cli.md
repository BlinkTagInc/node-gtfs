# Command line

[All guides](README.md)

The `gtfs` command can import and export SQLite data and refresh GTFS-Realtime
feeds. PostgreSQL and MySQL connections use the [JavaScript API](databases.md).

```sh
gtfs --help
gtfs import --help
gtfs export --help
gtfs realtime refresh --help
```

Put options after the command they apply to, for example `gtfs import --input`.

## Import Schedule data

```sh
gtfs import --input ./feed.zip --database ./transit.sqlite
gtfs import --url https://example.com/gtfs.zip --database ./transit.sqlite
gtfs import --config ./config.json
```

| Option              | Meaning                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `--input <path>`    | Local ZIP or directory.                                            |
| `--url <url>`       | Download a Schedule ZIP. Use instead of `--input`.                 |
| `--database <path>` | SQLite file to use. Specify a path for persistent data.            |
| `--source-id <id>`  | Identity for a direct `--input` or `--url`; defaults to `default`. |

Direct `--input` or `--url` replaces the entire configured `sources` list.
For sources in a config file, set `sources[].sourceId` in that file rather
than passing `--source-id`.

Import requires `--database` or `database.path` in your configuration. Use a
file path to keep the imported data. Explicit `--database :memory:` is allowed,
but all imported data is discarded when the command finishes.

## Export Schedule data

**The output directory is cleared before export.** Use a dedicated destination,
not your original static GTFS feed folder. See [export safety](export.md#choose-a-safe-output-directory).

```sh
gtfs export --database ./transit.sqlite --output ./exported-feed
gtfs export --database ./transit.sqlite --source-id metro --output ./metro-feed
```

| Option                 | Meaning                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `--database <path>`    | SQLite file containing imported data.                           |
| `--source-id <id>`     | Export this source; required when multiple sources would match. |
| `--output <directory>` | Destination for exported files.                                 |

## Refresh GTFS-Realtime

```sh
gtfs realtime refresh --config ./config.json
```

The config must enable `gtfs-realtime` and define GTFS-Realtime feeds. A command
fetches them once and exits; use your own scheduler for regular refreshes.
There is no command-line GTFS-Realtime feed URL override for GTFS-Realtime.

## Shared options

| Option                | Short form | Applies to                                                          |
| --------------------- | ---------- | ------------------------------------------------------------------- |
| `--config <path>`     | `-c`       | Import, export, refresh.                                            |
| `--log-level <level>` | `-l`       | Import, export, refresh. Values: `silent`, `error`, `warn`, `info`. |
| `--database <path>`   | —          | Import, export, refresh.                                            |
| `--help`              | `-h`       | Every command and command group.                                    |
| `--version`           | `-v`       | Every command and command group.                                    |

Without `--config`, the CLI reads `./config.json` if it exists. Explicit CLI
values override the corresponding config values. Direct input/database flags
can be used without a config file, but do not prevent an existing default
config file from being read.

Progress, warnings, and errors go to stderr; help and version output go to
stdout. Interactive terminals show animated progress. Redirected output uses
plain lines.

## Scripts and automation

```sh
gtfs import --config ./config.json --log-level warn
```

Thrown failures exit with status `1`. If you configure a Schedule source to
continue after errors, use the JavaScript result’s `success` and `errors`
fields when your automation needs to detect partial failures; a returned
unsuccessful import result does not itself set a failing CLI exit status.

## Next steps

- [Save settings in a sample configuration](configuration.md#sample-configuration-files).
- [Replace an updated static GTFS feed](import.md#replace-an-updated-static-gtfs-feed).
- [Choose a safe export destination](export.md#choose-a-safe-output-directory).
- [Configure GTFS-Realtime feeds and retention](realtime.md).
- [Explore imported data](getting-started.md#3-choose-how-to-explore-it).
- [Troubleshoot command and configuration failures](troubleshooting.md).
