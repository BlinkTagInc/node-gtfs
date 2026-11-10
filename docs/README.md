# node-GTFS documentation

[Project overview and quick start](../README.md)

Start with one static GTFS feed and SQLite. You can add more sources, a database server,
or GTFS-Realtime data when you need them.

The guides below are grouped by task. Field references list the supported files,
repositories, and values; each guide's **Next steps** links to related tasks.

Using PostgreSQL or MySQL? Start with [database setup](databases.md) before
importing your static GTFS feed.

## Get started

- [Getting started](getting-started.md): install node-GTFS, import a ZIP, and run your first query.
- [Command line](cli.md): import, export, and refresh GTFS-Realtime without writing a program.
- [Migrate from v4](migrating-to-v5.md): create a fresh database and update configuration and application calls.

## Import and manage static GTFS feeds

- [Import data](import.md): URLs, directories, multiple sources, repeat imports, and [performance settings](import.md#speed-up-imports).
- [Configure node-GTFS](configuration.md): start with a sample config, then choose inputs and settings.
- [Validation](validation.md): understand notices and choose how to handle imperfect static GTFS feeds.
- [Extensions](extensions.md): enable GTFS+, GTFS-Ride, GTFS-to-HTML, TODS, and TIDES.
- [Databases and instances](databases.md): SQLite, PostgreSQL, MySQL, source scope, and connection lifetime.
- [Cancellation](cancellation.md): stop import, export, or GTFS-Realtime refresh and understand what is preserved.

## Query and transform data

- [Query data](queries.md): select fields, sort, page, and stream results.
- [Filters](query-filters.md): equality, service dates and times, geographic bounds, and active alerts.
- [Custom SQL queries](sql-queries.md): connection rules, filters, source-aware joins, and distinct or representative rows.
- [Summaries and aggregates](aggregates.md): counts, totals, averages, and groups.
- [GeoJSON](geojson.md): stops, shapes, and route features for mapping.
- [Export data](export.md): write a source back to GTFS files.

## GTFS-Realtime

- [GTFS-Realtime](realtime.md): GTFS-Realtime feed configuration, current records, history, and cleanup.

## Reference

- [Configuration reference](reference/configuration.md): option names, accepted values, defaults, and per-operation overrides.
- [Files, fields, and data types](data-model.md): look up supported files, fields, and row types.
- [GTFS Schedule fields](reference/gtfs-schedule.md): agencies, routes, stops, trips, calendars, fares, and other Schedule files.
- [GTFS-Realtime fields](reference/gtfs-realtime.md): alerts, trip updates, vehicle positions, and retained message history.
- [GTFS+ fields](reference/gtfs-plus.md): additional calendar, direction, route, and stop attributes.
- [GTFS-Ride fields](reference/gtfs-ride.md): ridership and capacity records.
- [GTFS-to-HTML fields](reference/gtfs-to-html.md): timetable presentation settings and notes.
- [TODS fields](reference/tods.md): operations and Schedule supplements.
- [TIDES fields](reference/tides.md): vehicles and passenger, fare, and operational events.
- [V4 API replacements](reference/v4-api.md): replacements for getters, methods, row types, and error codes.

## Help and diagnostics

- [Troubleshooting](troubleshooting.md): common problems and how to investigate them.
- [Reporting and errors](reporting.md): progress, application logs, and structured diagnostics.
- [Changelog](../CHANGELOG.md): release notes and breaking changes.

In code examples, `gtfs` means an open `Gtfs` instance. Route IDs, trip IDs,
URLs, and paths are examples; replace them with values from your own static GTFS feed.
