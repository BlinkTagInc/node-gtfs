# Validation fixtures

These small static GTFS feeds exercise validation and reporting. They are not examples
of valid complete static GTFS feeds.

- `unknown-fields` contains an extra CSV column to test preservation and rejection.
- `missing-required-files` is a partial static GTFS feed for required-file errors.
- `nullable-keys` contains duplicate transfer keys with null components.

Use `fixture/complete` for all-fields round-trip tests.
