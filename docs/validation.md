# Validation

[All guides](README.md)

Static GTFS feed validation is optional and **off by default**. Import still parses and
normalizes values for the database, but does not check GTFS completeness or
relationships unless you enable validation.

Validation uses the rules supported by this package. It does not certify full
conformance to every GTFS or extension specification.

## Choose a validation mode

Set `sources[].schedule.import.validation.mode`:

| Mode            | Use it when…                                                | Behavior                                                                                                                                                      |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `off` (default) | You want to load data for analysis without GTFS validation. | Skips required-file/header checks and value, semantic, reference, and duplicate-key validation. Parsing, normalization, and database constraints still apply. |
| `strict`        | You want invalid source data rejected before replacement.   | Error-severity notices reject the source; warnings do not.                                                                                                    |
| `permissive`    | You need usable records from an imperfect static GTFS feed. | Reports supported structural and semantic problems without rejecting solely because of notice severity; unrepresentable rows are skipped.                     |

To enable validation, set `sources[].schedule.import.validation.mode` to
`"strict"`. At the normal `info` reporting level, imports with validation off
show a message with this setting. `permissive` runs the same checks as `strict`;
it changes how problems are handled, not how much validation is performed.

Warnings do not reject a source in `strict` mode. For example, a trip referring
to an unknown route currently produces a warning in both `strict` and
`permissive`; `off` does not check that reference. An unrepresentable field
value fails the import in `off` or `strict`, while `permissive` reports it and
skips the row. Archive, CSV parsing, and database write failures can still fail
an import in any mode.

## What off does and does not mean

You can import incomplete static GTFS feeds, references to missing records, and semantic
conflicts that the database can represent. Unknown columns are preserved by
default. This is not a byte-for-byte archive: normal parsing, defaults, time
normalization, and numeric conversion still apply.

Malformed ZIPs or CSV, unsafe or unrepresentable values, and violations of
database constraints still fail. With validation off, these failures do not
silently skip records. A failed source replacement restores the previous rows.
Duplicate keys still cannot coexist in a table; choose
`onDuplicateKey: "keep-first"` only when deliberately discarding later duplicates
is acceptable.

## Shapes for continuous-stop service

Trips that allow continuous pickup or drop-off require `shapes.txt`, a
`trips.shape_id`, and matching shape records. Validation checks route defaults
and stop-time overrides for travel between consecutive stops. Values `0`, `2`,
and `3` permit continuous stopping; `1` disables it.

Missing required geometry produces error-severity notices: `strict` rejects
the source before replacement, `permissive` reports the problem and continues,
and `off` does not check it. Fixed-stop static GTFS feeds without shapes remain valid.
Shapes are recommended for other route-based services, but their absence does
not produce a recommendation notice.

If `schedule.excludeFiles` excludes `routes.txt`, `trips.txt`, `stop_times.txt`,
or `shapes.txt`, this cross-file check is skipped. An intentionally partial
import cannot establish whether the original static GTFS feed meets this requirement.

## Unknown columns

Set `validation.onUnknownField`:

- `preserve` (default): keep unknown values in the row’s `_unknown_fields`
  database column as JSON. Export writes them as CSV columns again.
- `reject`: report unknown headers as errors; `strict` and `off` reject the source.
- `discard`: discard unknown values.

`_unknown_fields` is not returned by normal repository queries. Use
[direct database access](sql-queries.md#direct-database-queries) if your
application needs to read it. The column is always created and is null for
rows with no preserved unknown values.

These policies apply even with validation off. Preserving unknown columns is
silent in off mode; explicitly discarding or rejecting them produces a notice.

## Duplicate keys

Set `validation.onDuplicateKey` to `"keep-first"` to retain the first row for
each key and report later duplicates. The default is `"reject"`.

This concerns duplicate **keys**, not only byte-for-byte identical rows. Two
records with the same key and different values are duplicates too. Empty key
components participate in duplicate detection.

```json
{
  "database": { "path": "./transit.sqlite" },
  "sources": [
    {
      "schedule": {
        "path": "./feed.zip",
        "import": {
          "validation": {
            "mode": "strict",
            "onDuplicateKey": "keep-first",
            "onUnknownField": "preserve"
          }
        }
      }
    }
  ]
}
```

## Read a notice

A notice includes `code`, `severity`, `message`, and `filename`. It may also
include `sourceId`, `field`, `details`, `position`, and `firstPosition` for a
duplicate’s earlier record.

Positions distinguish CSV data records from physical lines. A quoted CSV value
can span several lines. `position.csvLineNumber` is the physical line where
the CSV record ends; `position.recordNumber` starts at 1 after the header.
GeoJSON positions use `featureNumber`, also starting at 1.

Common notices include missing required files/headers/values, invalid values,
out-of-range values, conditional field requirements, duplicate primary keys,
unknown fields, and references that could not be found.

For example, a trip’s `service_id` may be supplied by either `calendar.txt`
or `calendar_dates.txt`. A match in either is sufficient. Conditional
references, such as those in `translations.txt`, are checked only when their
conditions match the record.

`GTFS_REFERENCE_NOT_FOUND` can be a warning or an error. References marked
unambiguous by the schema use error severity; advisory relationships use warning
severity. Continuous-stop shape requirements can also raise reference severity.
Inspect the notice's `severity`, `field` and target details rather than deciding
from its code alone. Strict mode rejects error notices, while warnings permit
the import. References to unavailable or deliberately excluded target files are
left to file-level checks.

## Static GTFS feed validation versus database validation

When enabled, static GTFS feed validation happens during import. `gtfs.schema.validate()` checks the
database’s tables and columns, not whether an agency’s service data is correct.
See [database schema checks](databases.md#manage-tables).

## Next steps

- [Troubleshoot a rejected static GTFS feed](troubleshooting.md#validation-rejects-my-static-gtfs-feed).
- [Save every validation notice](reporting.md#save-every-validation-notice).
- [Look up field requirements and allowed values](data-model.md#files-and-repositories).
- [Import an updated static GTFS feed](import.md#replace-an-updated-static-gtfs-feed).
