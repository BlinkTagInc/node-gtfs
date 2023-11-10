# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.5.1] - 2023-11-09

### Updated

- Dependency updates
- Use path to types file instead of directory in package.json

### Fixed

- Exclude agency_id from export if empty

## [4.5.0] - 2023-08-23

### Updated

- Increase `maxInsertVariables` to 32,000
- Dependency updates

## [4.4.3] - 2023-07-18

### Updated

- Dependency updates

## [4.4.2] - 2023-07-08

### Changed

- Added index to stoptimes table for stop_id field 
- Updated node.js versions for tests

## [4.4.1] - 2023-07-07

### Changed

- Use lint-staged instead of pretty-quick

### Updated

- Dependency updates

## [4.4.0] - 2023-06-16

### Changed

- Pad leading zeros of timestamp columns

## [4.3.2] - 2023-06-14

### Updated

- Dependency updates
- node-csv `relax_quotes` config

## [4.3.1] - 2023-06-06

### Added

- Ignore system directories within zip file

### Updated

- Dependency updates

## [4.3.0] - 2023-05-04

### Updated

- Updated Readme to add closeDb documentation
- Use node-stream-zip instead of unzipper

### Added

- Support for prefixes when importing multiple GTFS files

## [4.2.0] - 2023-04-13

### Updated

- Add route_attributes to getShapesAsGeoJSON() function as geojson properties
- Add stop_attributes to getStopsAsGeoJSON() function as geojson properties
- Support for multi-column primary keys

## [4.1.1] - 2023-04-12

### Added

- Support for GTFS+ Files

### Updated

- Dependency updates

## [4.1.0] - 2023-02-25

### Added

- Support for Operational Data Standard (ODS) Files

### Updated

- Dependency updates

## [4.0.3] - 2023-02-04

### Changed

- Updates to sqlite journal mode

### Updated

- Dependency updates

## [4.0.2] - 2023-01-15

### Changed

- In getStopsAsGeoJSON only return stops that are part of a route.

### Updated

- Dependency updates

## [4.0.1] - 2022-12-31

### Updated

- Update types info
- Improved readme
- Improved queries

## [4.0.0] - 2022-12-30

### Changed

- Use better-sqlite3 library
- Make all query methods synchronous
- Remove `runRawQuery` (use Raw SQLite query instead)
- Remove `execRawQuery` (use Raw SQLite query instead)
- Remove `getDb` (use `openDb` instead)

## [3.8.0] - 2022-12-22

### Updated

- Dependency updates
- Add Node 18 tests

### Changed

- Make transfer_type not required in transfers.txt

## [3.7.0] - 2022-11-17

### Updated

- Dependency updates

### Added

- Add ignoreDuplicates config option

## [3.6.1] - 2022-11-08

### Updated

- Support for querying null values as part of an array

## [3.6.0] - 2022-08-08

### Added

- GTFS Fares v2 and new transfers.txt fields

### Updated

- Dependency updates
- Better examples in readme

## [3.5.1] - 2022-07-26

### Updated

- Dependency updates

## [3.5.0] - 2022-07-10

### Updated

- Use yoctocolors instead of chalk
- Dependency updates

### Fixed

- Support untildify in sqlitePath config variable

## [3.4.0] - 2022-06-12

### Updated

- Dependency updates
- Documentation updates
- Added default:, and source: keywords in the models to describe a default value and a source to transform from for GTFS-Realtime
- Filtering all models belonging to GTFS-Realtime from import (but not export) in GTFS

### Added

- Added trips-dates-vehicle-journey.txt model
- GTFS-Realtime Support for VehiclePositions, TripUpdates and ServiceAlerts
- gtfsrealtime-update script - does selective refresh of only GTFS-Realtime data without deleting the database
- updateGtfsRealtime() method - does selective refresh of only GTFS-Realtime data without deleting the database
- getServiceAlerts(..), getStopTimesUpdates(..), getTripUpdates(..), and getVehicleLocations(..) added methods
- advancedQuery, runRawQuery and execRawQuery methods to perform direct database queries

## [3.3.1] - 2022-04-29

### Added

- Add support for querying by shape_id

## [3.3.0] - 2022-04-26

### Changed

- Switched back to sqlite3 module

### Updated

- Dependency Updates

## [3.2.5] - 2022-04-09

### Updated

- Dependency Updates

## [3.2.4] - 2022-01-21

### Updated

- Dependency Updates

## [3.2.3] - 2022-01-16

### Added

- Implemented case-insensitive columns on import

### Updated

- Dependency Updates

## [3.2.2] - 2021-12-28

### Updated

- Dependency Updates

## [3.2.1] - 2021-11-26

### Updated

- Updated sqlite3 dependency to use @vscode/sqlite3 for npm audit warning
- Downgraded dtslint to 3.4.2 for npm audit warning

## [3.2.0] - 2021-11-21

### Added

- Support for opening multiple sqlite databases
- Basic TypeScript support (Matt Moran)

### Updated

- Readme updates
- Dependency updates

## [3.1.4] - 2021-10-17

### Added

- Husky and Prettier

### Update

- Downgraded node-sqlite3 library to released version

## [3.1.3] - 2021-10-17

### Added

- Added release-it

### Updated

- Updated pinned node-sqlite3 library

## [3.1.2] - 2021-09-25

### Changed

- Switch to recursive-copy library
- Change pinned node-sqlite path

### Updated

- Dependency updates

## [3.1.1] - 2021-09-013

### Updated

- Dependency updates - pinned sqlite3 version to solve security issue: https://github.com/mapbox/node-sqlite3/issues/1483

## [3.1.0] - 2021-08-02

### Changed

- Added database optimizations to greatly speed up import.

### Fixed

- Fix for timetable_notes_references schema

### Updated

- Dependency updates

## [3.0.4] - 2021-06-23

### Fixed

- Fix for timetable_notes_references schema

### Updated

- Dependency updates

## [3.0.3] - 2021-06-15

### Updated

- Dependency updates
- Use eslint instead of xo

## [3.0.2] - 2021-05-26

### Fixed

- Agency assignment for multi-agency GTFS in getShapesAsGeoJSON

### Updated

- Dependency updates

## [3.0.1] - 2021-05-15

### Fixed

- Better error messages for missing config
- Better error messages for invalid paths in config

### Changed

- Updated minimum node.js verstion to 14.17.0
- Added github action tests for node 16
- Dropped github action tests for node 12

### Added

- Tests for invalid path in config

### Updated

- Use copy-dir library
- Dependency updates

## [3.0.0] - 2021-05-13

### Breaking Changes

- Converted to ES Module
- Renamed `gtfs.import` to `gtfs.importGtfs`
- Renamed `gtfs.export` to `gtfs.exportGtfs`

### Changed

- Converted to ES Module

### Updated

- Dependency updates

## [2.4.4] - 2021-05-07

### Updated

- Dependency updates

## [2.4.3] - 2021-03-23

### Added

- Tests for GTFS-ride methods and models

### Updated

- Dependency updates

## [2.4.2] - 2021-02-19

### Fixed

- Exclude timestamp fields from export

### Updated

- Dependency updates

## [2.4.1] - 2021-02-09

### Fixed

- Updated transfers.txt model

### Updated

- Dependency updates

## [2.4.0] - 2021-02-04

### Added

- Support for `gtfsPath`, `gtfsUrl`, `exportPath` and `sqlitePath` parameters for `gtfs-import` and `gtfs-export` scripts.

### Changed

- Removed need for `agency_key` in config.json - use sanitized version of first `agency_name` in agencies.txt

### Updated

- Dependency updates

## [2.3.0] - 2021-01-20

### Fixed

- Update getDB test to handle unlimited serviceIds

### Updated

- Readme updates
- Reorganize table creation
- Better SQLite escaping
- Dependency updates

### Added

- GTFS-ride models and methods
- Support for exportPath config option
- Use pluralize library

## [2.2.4] - 2020-12-21

### Updated

- Updated github actions to test PRs and node 14.x
- Better default sqlitePath
- Detect TTY and use \n if not
- Better error message when sqlitePath is invalid
- Dependency updates

## [2.2.3] - 2020-12-12

### Updated

- Better default GTFS in config-sample.json
- Skip creating tables for excluded files

## [2.2.2] - 2020-12-10

### Updated

- Dependency updates (fixes https://github.com/advisories/GHSA-qqgx-2p2h-9c37)

## [2.2.1] - 2020-12-06

### Updated

- Improved shapes query

## [2.2.0] - 2020-12-05

### Updated

- Use unzipper library to handle poorly formed zip files
- Dependency updates

## [2.1.1] - 2020-11-27

### Fixed

- Don't log missing non-standard GTFS files
- Support for multiple agencies in one config file
- Dependency updates

## [2.1.0] - 2020-11-10

### Added

- Support for timetable_notes.txt and timetable_notes_references.txt

## [2.0.9] - 2020-11-10

### Changed

- Expand model character limit
- Don't require stop_name in stops.txt
- Dependency updates

## [2.0.8] - 2020-10-14

### Changed

- Improved validation on import

## [2.0.7] - 2020-10-13

### Added

- Support for extended GTFS route types

## [2.0.6] - 2020-10-13

### Changed

- Dependency updates

### Added

- Better error formatting
- GTFS import validation and better errors

## [2.0.5] - 2020-09-24

### Fixed

- Fix for selecting a single field.

## [2.0.4] - 2020-09-20

### Added

- Support for non-standard directions.txt file.
- Added getFareAttributes to README

## [2.0.3] - 2020-09-14

### Fixed

- Fix for querying for null

## [2.0.2] - 2020-09-06

### Changed

- Dependency updates

### Fixed

- Fix geojson property formatting

## [2.0.1] - 2020-08-23

### Added

- Updated model fields to latest GTFS spec
- Test for gtfs.getDb()
- Improved geoJSON generation

## [2.0.0] - 2020-08-20

### Changed

- Switched to SQLite
- Breaking changes for all queries
- Updated documentation

## [1.10.4] - 2020-07-28

### Added

- `start_time` and `end_time` fields in `timetables.txt`

## [1.10.3] - 2020-07-15

### Added

- Improved mongo connection documentation

### Fixed

- Dependency updates

## [1.10.2] - 2020-06-08

### Added

- Config option `csvOptions` to pass options to `csv-parse`.

## [1.10.1] - 2020-05-10

### Fixed

- Support for zipped GTFS files with subdirectories

## [1.10.0] - 2020-04-20

### Added

- Support for exporting GTFS zip files

## [1.9.1] - 2019-08-09

### Changed

- Better projections on all queries

## [1.9.0] - 2019-08-06

### Added

- `dataExpireAfterSeconds` config option
- `created_at` field on each document

### Fixed

- Removed invalid required fields from models
- Removed `date_last_updated` field from agency

## [1.8.9] - 2019-08-06

### Changed

- Logging improvements

## [1.8.8] - 2019-08-06

### Added

- Config option for custom logging function

## [1.8.7] - 2019-05-20

### Changed

- Use better temp directory for files

## [1.8.6] - 2019-05-11

### Fixes

- Remove .git from published npm package

## [1.8.5] - 2019-04-09

### Changed

- Prevent timeout on all queries

## [1.8.4] - 2019-03-31

### Added

- Index on stop_id

### Changed

- Strip byte-order-markers if present when importing

## [1.8.3] - 2019-03-26

### Added

- Support for GET headers

## [1.8.2] - 2019-03-11

### Changed

- Renamed config variable to `show_trip_continuation`

## [1.8.1] - 2019-02-28

### Added

- Changelog

### Changed

- Fixed issue with geojson consolidation

## [1.8.0] - 2019-02-28

### Changed

- Updated all methods so that query objects remain unchanged
- Updated dependencies

## [1.0.0] - 2017-07-17

### Breaking changes in version 1.0.0

As of version 1.0.0, all `node-gtfs` methods have changed to accept a query object instead of individual arguments. This allows for all fields of all GTFS files to be queried using this library. Most method names have been changed to be more general and more specific methods have been removed. For example, `getRoutes` now replaces `getRoutesByAgency`, `getRoutesById`, `getRoutesByDistance` and `getRoutesByStop`.

    // Old method with individual arguments, no longer supported in `node-gtfs` 1.0.0
    gtfs.getRoutesByStop(agency_key, stop_id)
    .then(routes => {
      // do something with the array of `routes`
    })

    // Query in `node-gtfs` version 1.0.0
    gtfs.getRoutes({
      stop_id: '123'
    })
    .then(routes => {
      // do something with the array of `routes`
    })

## [0.11.0] - 2017-07-04

As of version 0.11.0, `node-gtfs` methods don't support callbacks. Use promises instead:

    gtfs.getAgencies()
    .then(agencies => {
      // do something with the array of `agencies`
    })
    .catch(err => {
      // handle errors here
    });

Or, you use async/await:

    const myAwesomeFunction = async () => {
      try {
        const agencies = await gtfs.getAgencies();
      } catch (error) {
        // handle errors here
      }
    }
