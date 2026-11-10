# Reporting and errors

[All guides](README.md)

The JavaScript API is silent unless you supply a reporter. Operation results
and thrown errors remain available whether or not messages are displayed.

## Show progress

```js
import { importGtfs, createConsoleReporter } from 'gtfs';

const result = await importGtfs({
  database: { path: './transit.sqlite' },
  sources: [{ schedule: { path: './feed.zip' } }],
  reporting: {
    level: 'info',
    reporter: createConsoleReporter({ animateProgress: true }),
  },
});
```

`createConsoleReporter()` writes to `process.stderr` by default. Its optional
`stream` accepts a writable stream, such as `process.stdout`. Animation defaults
to on for interactive terminals and off otherwise; omit `animateProgress` to
use that detection.

The CLI also sends progress, warnings, and errors to stderr. Help and version
output go to stdout. Use `--log-level` to reduce progress output.

| `reporting.level` | Delivered events                        |
| ----------------- | --------------------------------------- |
| `silent`          | None.                                   |
| `error`           | Errors only.                            |
| `warn`            | Warnings and errors.                    |
| `info`            | Progress, status, warnings, and errors. |

With a reporter supplied, the default level is `info`. Level filtering does
not affect the validation counts or samples in returned results.

## Use your own logger

```js
import { Gtfs } from 'gtfs';

const gtfs = new Gtfs({
  database: { path: './transit.sqlite' },
  reporting: {
    level: 'warn',
    reporter: (event) => {
      console.error(event.level, event.message);
      if (event.type === 'validation:notice') {
        console.error(event.notice.code, event.notice.position);
      }
    },
  },
});

try {
  gtfs.reporting.log({ level: 'info', message: 'Reading transit data' });
  console.table(await gtfs.schedule.routes.all());
} finally {
  await gtfs.close();
}
```

Here the `info` message is filtered out. A reporter is a synchronous
`GtfsReporter` callback; do not rely on node-GTFS awaiting an async logger.
Keep the callback quick and avoid throwing from it.

Each `GtfsReportEvent` includes `type`, `level`, `message`, `operationId`, and
`timestampMs` (Unix milliseconds). Additional fields depend on `type`:

| Event type           | Useful fields                                                  |
| -------------------- | -------------------------------------------------------------- |
| `operation:start`    | `operation`, optional `sourceCount` and `sourceIds`.           |
| `status`             | `phase` (`start` or `complete`), optional source/file context. |
| `progress`           | `current`, optional `total`, source/file context.              |
| `validation:notice`  | `notice`, including its code and position.                     |
| `message`            | Application/operation message and optional error details.      |
| `schema:recreate`    | Tables being recreated and database description.               |
| `operation:complete` | `operation`, `durationMs`, optional result/destination.        |

Operations are named `import`, `export`, `realtime`, `cleanup`, or `validation`.
Use event types and codes for logic instead of parsing message text.

## Catch an error

```js
import { importGtfs, isGtfsError, GtfsErrorCode, formatGtfsError } from 'gtfs';

try {
  await importGtfs({
    database: { path: './transit.sqlite' },
    sources: [{ schedule: { path: './feed.zip' } }],
  });
} catch (error) {
  if (!isGtfsError(error)) {
    throw error;
  }

  console.error(formatGtfsError(error, { audience: 'user' }));
  if (error.code === GtfsErrorCode.VALIDATION_FAILED) {
    console.table(error.details?.validation?.samples);
  }
  process.exitCode = 1;
}
```

`GtfsError` exposes `code`, `category`, `message`, and optional `details`,
`cause`, `statusCode`, `position`, or `positions`. Categories group errors
such as `config`, `download`, `validation`, `database`, `parse`, and `query`.
For example, `GtfsErrorCode.CONFIG_INVALID` has the string value
`"GTFS_CONFIG_INVALID"`.

[Cancelled operations](cancellation.md) reject with
`GtfsErrorCode.OPERATION_CANCELLED` (`GTFS_OPERATION_CANCELLED`), category
`cancellation`, and the caller's signal reason in `cause`.

If an operation and its cleanup both fail, `cause` is an `AggregateError`:
`cause.errors[0]` is the original error and subsequent entries contain cleanup
failures, such as rollback, settings restoration, or connection release. The
original GTFS code, category, and source positions are preserved. For cancellation
in this case, the signal reason is in `cause.errors[0].cause`.

`details.databaseRecoveryRequired === true` means cleanup failed or the database
could not confirm a transaction boundary. Stop writing, inspect the stored data
and connection settings, and [recover the connection](databases.md#connection-ownership-and-closing)
before reusing it or retrying. A failed commit acknowledgement or cleanup after
commit can leave writes stored even though the operation rejected.

`formatGtfsError(error, { audience: 'user' })` returns a short message.
`audience: 'developer'` (the default) includes the code and structured context.
Review diagnostic output for credentials or private data before sharing it.

Source URLs in download messages and errors keep ordinary query parameters such
as `agency` and `route`. Common credential values, including API keys, tokens,
`sig`, `hmac`, and signed-URL `Policy` values, appear as `***`. URL usernames,
passwords, and fragments are omitted. Custom credential names may not be
recognized; review URLs before sharing logs.

## Save every validation notice

Import results keep at most 100 notice samples. A reporter receives every
`validation:notice` event permitted by its reporting level; use `info` to include
all severities. Write notices as they arrive to avoid collecting them in memory:

```js
import { closeSync, openSync, writeFileSync } from 'node:fs';
import { importGtfs } from 'gtfs';

const reportFile = openSync('./validation.jsonl', 'wx');
try {
  await importGtfs({
    database: { path: './transit.sqlite' },
    sources: [
      {
        schedule: {
          path: './feed.zip',
          import: { validation: { mode: 'permissive' } },
        },
      },
    ],
    reporting: {
      level: 'info',
      reporter(event) {
        if (event.type === 'validation:notice') {
          writeFileSync(reportFile, JSON.stringify(event.notice) + '\n');
        }
      },
    },
  });
} finally {
  closeSync(reportFile);
}
```

This creates a new file containing one JSON notice per line, including notices
from a source that is later rejected. It refuses to overwrite an existing report.
Review it for sensitive source data before sharing it.

## Read diagnostic details

- Configuration errors can include `details.errors`, an array of
  `GtfsConfigIssue` entries identifying the invalid `path`, `reason`, and
  `message`.
- Validation rejection can include `details.validation`, with complete counts
  and at most 100 notice samples. Check `countsByCode`, `countsBySeverity`, and
  `truncated`, not just `samples`, to understand the scope of the findings. A
  `GtfsValidationNotice` has `code`, `severity`, `message`, `filename`, and
  optional `sourceId`, `field`, `position`, `firstPosition`, and `details`.
- Schema errors can include `details.schema`, with `compatible` and
  `tableIssues` as described in [database inspection](databases.md#manage-tables).

`GtfsSourcePosition` tells you which kind of input was involved:

| `position.kind` | Location                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `csv`           | `recordNumber`: one-based data record, excluding the header. `csvLineNumber`: physical line where that record ends, including the header. |
| `geojson`       | `featureNumber`: one-based position in the features array.                                                                                |
| `realtime`      | `entityNumber`: one-based position in the GTFS-Realtime message’s entity array.                                                           |

CSV records can span lines, so record number and line number can differ.
For a failed write batch, `error.positions` lists records in the batch; it
does not mean that every listed record is invalid.

If Schedule import is configured to continue after source errors, check
`result.success` and `result.errors` even when no exception is thrown.

## Find help for a warning

Use the notice code or warning message to find the relevant setting or recovery
steps:

| Warning                                                                          | Help                                                                                                                              |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GTFS_UNKNOWN_FIELD`                                                             | [Preserve, discard, or reject unknown columns](validation.md#unknown-columns).                                                    |
| `GTFS_DUPLICATE_PRIMARY_KEY`                                                     | [Handle duplicate keys](validation.md#duplicate-keys).                                                                            |
| `GTFS_REFERENCE_NOT_FOUND`                                                       | [Inspect reference severity](validation.md#read-a-notice) and [choose a validation mode](validation.md#choose-a-validation-mode). |
| `GTFS_EXTENSION_DISABLED`                                                        | [Enable the intended extension](extensions.md#enable-explicitly).                                                                 |
| Default agency used                                                              | [Configure the agency fallback](reference/configuration.md#schedule-input).                                                       |
| Tables will be recreated                                                         | [Back up or validate existing tables](databases.md#manage-tables).                                                                |
| Missing, unsupported, or ambiguous GTFS-Realtime entities; invalid tombstones    | [Understand skipped entities](realtime.md#skipped-entities).                                                                      |
| `GTFS_REALTIME_INCREMENTALITY_UNSUPPORTED`                                       | [Choose supported refresh behavior](realtime.md#refresh-behavior-and-history).                                                    |
| `GTFS_REALTIME_ALERT_PERIOD_INVALID`, `GTFS_REALTIME_ALERT_IMPACT_NOT_CONTAINED` | [Correct alert time ranges](realtime.md#alerts-and-time-ranges).                                                                  |
| Download retries                                                                 | [Troubleshoot a failed download](troubleshooting.md#a-download-fails-or-times-out).                                               |
| Export cleanup or reservation release failed                                     | [Inspect export output and recovery artifacts](troubleshooting.md#export-is-incomplete-or-files-disappeared).                     |
| No data exported, or multiple agencies in one export                             | [Check the selected source and export contents](export.md#which-data-is-exported).                                                |

## Next steps

- [Understand static GTFS feed validation notices](validation.md).
- [Find solutions to common problems](troubleshooting.md).
- [Handle cancellation](cancellation.md).
- [Recover a failed transaction or connection](databases.md#connection-ownership-and-closing).
