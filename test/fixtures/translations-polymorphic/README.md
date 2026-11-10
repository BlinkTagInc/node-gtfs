# Polymorphic translations fixture

This fixture covers every official `translations.txt` record-ID mapping from
the GTFS Schedule reference and its recommended unofficial mappings for
`calendar`, `calendar_dates`, `fare_attributes`, `fare_rules`, `shapes`,
`frequencies`, and `transfers`.

The `record_sub_id` values intentionally exercise each value role:

- `stop_times.stop_sequence`, `calendar_dates.date`, and
  `frequencies.start_time` are scalar values and must remain unchanged;
- `fare_rules.route_id` and `transfers.to_stop_id` are source references whose
  values remain unchanged beside `source_id`;
- the custom-table row demonstrates that unknown roles are not transformed.

The last agency row duplicates a primary key whose `record_sub_id` and
`field_value` are null. With duplicate ignoring enabled, the portable canonical
key must retain only the first row.
