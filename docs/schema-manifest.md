# GTFS schema manifest

Each table under `src/schema/tables/<namespace>` is declared with
`defineGtfsTable`. The rich declaration is the source of truth for file and
field presence, field types, primary keys, semantic metadata, and storage
indexes. Schema infrastructure lives alongside those declarations in
`src/schema`; these are table definitions, not behavioral domain models. Field
definitions are plain objects with an explicit `kind`, so the manifest remains
data rather than a collection of field-construction calls.

The standard-table metadata currently targets the GTFS Schedule reference
revision exported as `gtfsScheduleReferenceRevision` (`2026-04-27`). This is a
declared review baseline, not a claim that v4 now rejects every non-conforming
feed.

Table exports are the plain definitions passed to `defineGtfsTable`; they no
longer expose the legacy `filenameBase`, `filenameExtension`, or `schema`
projection. A private compiler derives SQL table names, file extensions, and
storage columns for runtime consumers. Both the SQLite and Kysely schema writers
obtain single-column and composite indexes exclusively from table storage
metadata.

The complete JSON-serializable manifest is exported as `gtfsManifest` from
`gtfs/schema`. That entry point also exports every table declaration directly
and through the `tables` namespace. The former `gtfs/models` package export is
removed rather than retained as a deprecated alias. Queryable table references
are also projected as `gtfsJoins`. References to fields inside structured
source files, such as GeoJSON feature IDs, remain in the manifest but are
omitted from SQL joins.
The same entry point exports the table-definition API and inferred
`GtfsRow`, `GtfsStoredRow`, `GtfsInsert`, `GtfsQuery`, and `GtfsDatabase` types.
The root package exports these too.

## Design decisions

- Table definitions use `presence` for files and field definitions use it for
  values. A future validator can distinguish a missing CSV column from an empty
  value by inspecting the header and records separately, without duplicating
  presence metadata.
- `id` is a semantic field kind stored as text. This avoids assigning numeric
  meaning to identifiers. `applyFeedPrefix` explicitly marks identifiers that
  are rewritten when feeds are merged.
- Time fields retain their GTFS string value. The current node-gtfs timestamp
  helper columns are storage projections and are reflected only in stored-row
  types.
- Enum values, cross-file references, inclusive `minimum` and `maximum` bounds,
  and cross-field range rules are retained as semantic metadata. References
  use a consistent `[{ file, field }]` shape, and multiple entries are
  alternative targets. They are not automatically promoted to hard foreign
  keys; GTFS-Realtime references can be conditional on schedule relationships.
- Storage indexes are dialect-neutral declarations. Dialect-specific details,
  such as SQLite partial indexes and MySQL text prefixes, remain writer policy.
- Enumeration fields require a non-empty `values` tuple, while other field
  kinds reject `values`. `sourcePath` locates GTFS-Realtime values in decoded
  entities. A field's `defaultValue` is applied during normalization when its
  static or realtime source value is missing or empty, before any writer sees
  the row.
- `caseInsensitiveComparison` requests case-insensitive database comparison
  where the selected writer supports it.
- Every table has an explicit namespace, constrained by the `GtfsNamespace`
  union. The namespace uses the current TODS name instead of ODS.

This follows the same broad split used by the MobilityData Canonical GTFS
Validator: generated structural schemas and loaders handle regular field rules,
while custom validators handle semantic and cross-record rules. See its
[validator architecture](https://github.com/MobilityData/gtfs-validator/blob/master/docs/ARCHITECTURE.md).
GTFS Schedule presence and field rules should be checked against the current
[official reference](https://gtfs.org/documentation/schedule/reference/) when a
table is added or updated.

## Deferred to the next major release

The following work can change accepted inputs, returned values, public types,
or error timing, so it is intentionally not enabled by this v4 refactor:

- Make normalization produce fully typed rows before any database writer. The
  current compatibility path retains its existing SQLite-oriented coercion.
- Enforce required files, required CSV headers, and conditional field rules
  directly from the manifest. This may reject feeds that v4 currently accepts.
- Add structured semantic validation notices, including cross-field,
  cross-row, and cross-file rules. Decide which notices, if any, are fatal.
- Audit conditional and polymorphic references against each future GTFS
  specification revision. Do not turn advisory join metadata into hard database
  foreign keys without a separate compatibility decision.
- Replace the hand-maintained public row/query interfaces and getter signatures
  with inferred manifest types after resolving their existing aliases and
  historical result shapes.
- Decide whether public repositories should return Kysely builders or remain
  synchronous value-returning functions. Returning builders would be breaking.
- Generate checked-in field-reference documentation and complete conformance
  snapshots from the manifest.
