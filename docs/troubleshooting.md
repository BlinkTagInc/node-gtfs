# Troubleshooting

## Node.js is too old

node-GTFS requires Node.js 22 or newer.

```bash
node --version
```

Install a current Node.js release, start a new terminal, and run the command
again if the reported major version is lower than 22.

## `gtfs-import` is not found

Install node-GTFS in the current project and run the local command through
`npx`:

```bash
npm install gtfs
npx gtfs-import --help
```

If you installed with `npm install --global gtfs`, restart the terminal and
check that npm's global binary directory is on your `PATH`. A local installation
is usually easier to reproduce.

## The database disappeared after import

SQLite defaults to an in-memory database when `sqlitePath` is omitted. An
in-memory database is deleted when the process exits. Import again with a file:

```bash
npx gtfs-import --gtfsPath ./data/gtfs.zip --sqlitePath ./gtfs.sqlite
```

Use that exact same path when querying, updating realtime data, or exporting.

## The database is empty or has no GTFS tables

Common causes are:

- Importing into one database path and querying another
- Running commands from different directories with relative paths
- Importing into the default in-memory database
- Continuing after an error with `ignoreErrors: true`
- Excluding the table you expected to query

Use absolute paths temporarily if you are unsure which file a command opens.
Review the import summary and any preceding warnings or errors.

## The configuration file cannot be found

Without `--configPath`, commands look for `config.json` in the current working
directory, not necessarily beside your JavaScript file.

```bash
npx gtfs-import --configPath ./config/import.json
```

Check the current directory and make sure the filename uses the same letter
case as the command.

## The configuration is invalid JSON

JSON requires double quotes around keys and strings and does not allow trailing
commas or comments. This is valid:

```json
{
  "agencies": [
    {
      "path": "./data/gtfs.zip"
    }
  ],
  "sqlitePath": "./gtfs.sqlite"
}
```

If you need functions, environment variables, or comments, configure node-GTFS
in JavaScript instead of JSON.

## SQLite cannot open the database

The parent directory must already exist and be writable. For example, create
`data` before using `./data/gtfs.sqlite`:

```bash
mkdir data
```

Also check whether another process has locked the file and whether the path
points to a directory instead of a database file.

## The GTFS ZIP cannot be read

A GTFS ZIP should contain `.txt` files at its top level or inside one
subdirectory. Archives containing multiple feed subdirectories should be split
and listed as separate agency entries.

If importing an extracted directory, point `path` at the directory containing
`agency.txt`, `stops.txt`, and the other GTFS files.

## `better-sqlite3` does not install

`better-sqlite3` is a native dependency. Start by using a supported Node.js
version and a current npm release:

```bash
node --version
npm --version
npm install gtfs
```

When a prebuilt binary is unavailable for your operating system or CPU, npm
may need local compiler tools. The error output normally identifies the missing
tool. Avoid suppressing install scripts because the native module needs its
installation step.

## Imports take a long time

Large feeds, especially those with `shapes.txt` and `stop_times.txt`, can use
substantial CPU, memory, and disk space. Let the import finish, make sure the
destination has free space, and exclude tables you do not need:

```json
{
  "agencies": [
    {
      "path": "./data/gtfs.zip",
      "exclude": ["shapes"]
    }
  ],
  "sqlitePath": "./gtfs.sqlite"
}
```

## Getting more diagnostic output

Use `logLevel: "info"`, which is the default. Do not use `ignoreErrors` while
diagnosing an import unless you specifically need to inspect a partial import.

When opening an [issue](https://github.com/BlinkTagInc/node-gtfs/issues),
include:

- node-GTFS version (`npx gtfs-import --version`)
- Node.js version (`node --version`)
- Operating system
- Command or minimal JavaScript example
- Complete error output
- A public feed URL, when possible

Remove credentials and private URLs before posting.
