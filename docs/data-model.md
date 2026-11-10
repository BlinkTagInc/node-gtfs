# Files, fields, and data types

[All guides](README.md)

Use this guide to find the repository for a file, inspect supported fields,
or type a custom database query. For ordinary queries, start with
[query basics](queries.md).

## Files and repositories

For example, `gtfs.schedule.stopTimes.all()` reads stop-time records. Optional files may
have no rows; [extension selection](extensions.md) controls optional formats.

Choose a format to see its files, repositories, fields, defaults, references,
and available query filters:

- [GTFS Schedule](reference/gtfs-schedule.md)
- [GTFS-Realtime](reference/gtfs-realtime.md)
- [GTFS+](reference/gtfs-plus.md)
- [GTFS-Ride](reference/gtfs-ride.md)
- [GTFS-to-HTML](reference/gtfs-to-html.md)
- [TODS](reference/tods.md)
- [TIDES](reference/tides.md)

GTFS-Realtime data comes from protobuf messages, not one CSV per table. See
[GTFS-Realtime](realtime.md) for current records and retained history.

## Look up fields

`gtfsManifest` from `gtfs/schema` describes the fields supported by the
installed package. It is keyed by database table name:

```js
import { gtfsManifest } from 'gtfs/schema';

const routes = gtfsManifest.routes;
console.log(routes.filename);
console.log(routes.defaultSelectedFields);
console.log(routes.fields.route_type.kind);
```

| Metadata                    | Use                                                                   |
| --------------------------- | --------------------------------------------------------------------- |
| `filename`                  | Input/export filename, or `null` for GTFS-Realtime tables.            |
| `tableName`                 | Name for direct database queries.                                     |
| `specification`             | Core format or extension the table belongs to.                        |
| `presence`                  | Whether the source file is required, optional, or conditional.        |
| `fields`                    | Fields keyed by their exact names.                                    |
| `inputFields`               | Recognized fields; GTFS-Realtime entries describe flattened records.  |
| `defaultSelectedFields`     | Fields returned by a repository without `select()`.                   |
| `derivedFields`             | Generated fields that can be selected explicitly.                     |
| `primaryKey`                | Field combination identifying a record in the source format.          |
| `storageKey`, `keyStrategy` | How database records are uniquely identified, including their source. |
| `indexes`                   | Declared query indexes.                                               |
| `constraints`               | Declared cross-field conditions.                                      |

A field definition includes its `kind` and, where applicable, `presence`,
`defaultValue`, `minimum`, `maximum`, `values`, `references`, and
`supportsCaseInsensitiveComparison`. Conditional references include a
`when` condition; do not assume all possible targets apply to every row.

`gtfs.schema.tables` and each repository's `tableName`, `filename`, and
`specification` provide a smaller metadata view. These describe registered
tables, not whether a table exists or an extension is enabled. Use
`gtfs.schema.validate()` to inspect the database.

## Row representations

Source files and repository results do not always use the same value types:

| Representation | Example or behavior                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source         | CSV values are text: `stop_sequence` might be `"5"`, and `arrival_time` might be `"25:10:00"`.                                                                           |
| Normalized     | Numeric fields become numbers, dates become `YYYYMMDD` numbers, and times remain strings. Empty optional values use the field default or `null`. IDs remain strings.     |
| Stored         | Database rows include `source_id`. Monetary fields use integer minor units; `_unknown_fields` contains preserved unknown fields as JSON, or `null` when none are stored. |
| Derived        | `arrival_service_day_seconds` is `90600` for `"25:10:00"`. These columns are created automatically and can be selected explicitly.                                       |
| Default result | A repository returns `source_id` and its listed fields. Monetary values are decimal strings. Derived fields and `_unknown_fields` are not included.                      |

JSON fields are returned as JSON strings, not parsed objects. The field reference
lists each returned type and whether it may be `null`. Normalization does not
make an invalid static GTFS feed valid; [validation settings](validation.md) govern rejection.

Select derived fields explicitly:

```js
const arrivals = await gtfs.schedule.stopTimes
  .select('trip_id', 'arrival_time', 'arrival_service_day_seconds')
  .all();
```

`_unknown_fields` and database-only key columns are not repository-selectable.
Use [direct database access](sql-queries.md#direct-database-queries) when needed.

## Row types

Filename-based types preserve the filename stem, starting with a capital:
`Agency`, `Routes`, `StopTimes`, `Calendar`, and `CalendarDates`.
They describe normal repository results, including `source_id`.

```ts
import type { StopTimes, GtfsStoredTableRow } from 'gtfs';
import type { GtfsDatabase } from 'gtfs/schema';

type Arrival = Pick<StopTimes, 'trip_id' | 'stop_id' | 'arrival_time'>;
type StoredStopTime = GtfsStoredTableRow<'stop_times'>;
type DatabaseTables = GtfsDatabase;
```

Use inferred query results when selecting only some fields. Use
`GtfsStoredTableRow<TableName>` and `GtfsDatabase` for direct database
access: those rows can include generated fields and `_unknown_fields`, with
storage representations such as integer monetary minor units. Stored monetary
columns are typed as `number | bigint | string` because driver settings determine
the returned representation. Reader monetary fields remain decimal strings.
Cast large SQL amounts to text before reading them to avoid driver rounding.

## Identifiers and references

GTFS identifiers retain their source values. Physical uniqueness also
accounts for `source_id`; nullable multi-field keys are enforced even when
parts of the key are empty. GTFS-Realtime identities additionally use GTFS-Realtime feed,
snapshot, or child-position fields as appropriate.

References describe relationships, not enforced database foreign keys.
Import validation can report missing references; an absent related row does
not automatically prevent all other rows from being stored. Use
[SQL joins](sql-queries.md#joining-related-records) for source-aware relationships.

Translations keep their specification field names and reference values.
For example, `translations.record_sub_id` can refer to a stop sequence,
not just an identifier. It is not prefixed with a source ID.

## Next steps

- [Select fields and query records](queries.md).
- [Join records using source and GTFS-Realtime feed keys](sql-queries.md#joining-related-records).
- [Read stored values with custom SQL](sql-queries.md#direct-database-queries).
- [Enable optional file formats](extensions.md).
- [Validate static GTFS feed fields and references](validation.md).
