# Complete GTFS fixture

A small, hand-written GTFS feed in which **every `gtfs-schedule` table has rows
and every column holds a non-null value** (32 tables, 220 columns).

It exists because the real-agency fixture (`caltrain_20160406.zip`) leaves 53 of
63 tables empty and 38% of the columns in the tables it does populate entirely
NULL. Those columns were only ever asserted as `null`, so nothing verified that
a real value survives import, storage, and export. This fixture covers that.

Values are deliberately distinctive (`safe_duration_factor=1.25`,
`shape_dist_traveled=1500.75`, `route_sort_order=1`) so a column that gets
dropped, truncated, or coerced to the wrong type is visible in a diff.

## Not a validity example

This feed is **not** spec-conformant, and should not be copied as a model of
valid GTFS. To reach full column coverage it populates fields the spec marks
conditionally forbidden in combination — for example both `routes.network_id`
and `route_networks.txt`. node-GTFS enforces `required` but treats
`conditionallyRequired` / `conditionallyForbidden` as documentation, so these
import cleanly. Use `caltrain_20160406.zip` when a test needs a realistic feed.

## Stored unzipped

Kept as plain files rather than a zip so changes are reviewable in a diff.
`importGtfs` accepts a directory path directly.
