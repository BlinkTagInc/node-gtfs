# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
      agency_key: 'caltrain',
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
