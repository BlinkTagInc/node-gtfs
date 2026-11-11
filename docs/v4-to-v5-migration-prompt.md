# Prompt for migrating an application to node-GTFS v5

Paste the following into a coding assistant with access to your application repository.

```text
Migrate this application from node-GTFS v4 to v5 (npm package: gtfs).
Implement and test the changes in this repository.

1. Identify the installed v4 version, package manager, supported Node versions,
   and the v5 release requested. Use the target release's docs/migrating-to-v5.md,
   docs/reference/v4-api.md, public exports, and TypeScript declarations. Use its
   packaged docs or a matching tag/checkout. Update the dependency, lockfile, and
   runtime requirements where needed.

2. Trace how data reaches the user. Inspect imports and wrappers, raw SQL,
   types, CLI commands, configuration, scheduled jobs, and tests. Before
   changing the dependency, run a representative local feed through the v4
   entry points and save the output in a temporary directory. Record existing
   failures. Identify what callers rely on: identifiers, filenames, return
   values, field types, ordering, date filters, and any missing-data fallback.

3. Create a fresh v5 database and reimport the same original feeds. Give each
   feed a stable sourceId. Keep the v4 database available for rollback. Keep
   application-owned config separate from node-GTFS options. Translate public
   app settings at the boundary if existing callers depend on them. Enable
   the extensions the app reads. Check the import result before generating
   output. Report options that lack an equivalent.

4. Replace implicit database access with explicitly owned Gtfs instances.
   Keep the instance alive across an in-memory import and its reads, await
   operations through the caller chain, and close owned resources on success
   and failure. Use source-scoped readers. For direct SQL, include source_id
   in predicates and joins, plus realtime_feed_id where applicable.

5. Choose replacements by what each caller consumes. For example, if it used
   getShapesAsGeoJSON(), check whether it expects a feature per route or per
   shape. If it selects a direction or date range, verify the coordinates and
   stops belong to the matching trips. A route selector can return the whole
   route. Preserve application fallbacks, such as drawing a line through stops
   when shapes.txt is missing. Apply these checks only to features this app uses.

6. Run the build, existing checks, and the same end-to-end fixture on v5.
   Compare meaningful output, including files and properties, and explain
   differences. For multi-feed apps, exercise overlapping GTFS IDs. For apps
   that reuse a database, test importing, closing, and reopening it. Add a
   focused regression test for behavior the existing suite misses.

Report the exact version tested, files changed, commands and outcomes, any
remaining differences, and how to cut over or roll back a persistent database.
Distinguish tests against a local checkout from a clean package installation.
```
