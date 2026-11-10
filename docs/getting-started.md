# Getting started

[All guides](README.md)

This guide loads one static GTFS feed into a local database. You need a GTFS ZIP
from a transit agency and Node.js 22.18+ (22.x), 24, or 26+. A **terminal** is the application
where you enter commands; on macOS it is called Terminal.

Already using PostgreSQL or MySQL? Follow the [database setup examples](databases.md)
to import with your existing server instead.

## 1. Check Node.js and install node-GTFS

```sh
node --version
npm install --global gtfs
gtfs --help
```

`npm` is the package installer included with Node.js. If the first command is
not found, install Node.js before continuing.

## 2. Import your static GTFS feed

In the folder containing your ZIP, run:

```sh
gtfs import --input ./feed.zip --database ./transit.sqlite
```

Use the actual ZIP filename. The database is saved as `transit.sqlite` in
your current folder. SQLite stores the data in a file, so no database server
setup is needed.

Static GTFS feed validation is off by default. To check GTFS rules during import, enable
it in your configuration; see the [validation guide](validation.md).
Parsing and database errors can still stop an import. Read the reported
filename and field, and review any warnings.

Running the same command again replaces the Schedule data for this source.
See [repeat imports](import.md#replace-an-updated-static-gtfs-feed) before working with
more than one source.

## 3. Choose how to explore it

You can open `transit.sqlite` with a SQLite database viewer and inspect tables
such as `routes`, `stops`, and `trips`. To use the JavaScript API, install the
package in your project folder:

```sh
npm init -y
npm install gtfs
```

Save this as `routes.mjs` beside `transit.sqlite`:

```js
import { Gtfs } from 'gtfs';

const gtfs = new Gtfs({
  database: { path: './transit.sqlite' },
});

try {
  const routes = await gtfs.schedule.routes
    .select('route_id', 'route_short_name', 'route_long_name')
    .orderBy([{ field: 'route_id', direction: 'asc' }])
    .all();
  console.table(routes);
} finally {
  await gtfs.close();
}
```

Run it with:

```sh
node routes.mjs
```

`await` waits for a database operation to finish. `all()` retrieves the
matching records, and `select()` chooses which fields you want to see.
Closing the instance releases its database connection.

## Import and query in one script

If your program should perform the import itself:

```js
import { Gtfs, createConsoleReporter } from 'gtfs';

const gtfs = new Gtfs({
  database: { path: './transit.sqlite' },
  sources: [{ schedule: { path: './feed.zip' } }],
  reporting: { reporter: createConsoleReporter() },
});

try {
  await gtfs.import();
  const stops = await gtfs.schedule.stops
    .select('stop_id', 'stop_name')
    .limit(10)
    .all();
  console.table(stops);
} finally {
  await gtfs.close();
}
```

## Next steps

- [Find trips and arrivals](queries.md#query-service-routes-and-stops).
- [Make map features](geojson.md).
- [Save reusable settings with a sample configuration](configuration.md#sample-configuration-files).
- [Load multiple agencies or static GTFS feeds](import.md#use-more-than-one-source).
- [Export GTFS files](export.md) or [add GTFS-Realtime updates](realtime.md).
- [Check static GTFS feed quality and interpret validation notices](validation.md).
