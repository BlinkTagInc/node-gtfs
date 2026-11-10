# GTFS-Realtime

[All guides](README.md)

GTFS-Realtime provides updates such as delays, vehicle positions, and service
alerts. node-GTFS downloads a GTFS-Realtime message when you ask it to refresh, stores its
current entities, and keeps the original protobuf payload for inspection.
It does not poll GTFS-Realtime feeds automatically.

## Configure and refresh

For a template with authentication, timeout, and retention settings, start
with [config-sample-realtime.json](../config-sample-realtime.json). See
[how to use the samples](configuration.md#sample-configuration-files).

Save a configuration with the agency’s actual protobuf URLs:

```json
{
  "database": { "path": "./transit.sqlite" },
  "extensions": ["gtfs-realtime"],
  "sources": [
    {
      "realtime": {
        "feeds": [
          { "type": "alerts", "url": "https://example.org/alerts.pb" },
          { "type": "tripUpdates", "url": "https://example.org/trips.pb" },
          {
            "type": "vehiclePositions",
            "url": "https://example.org/vehicles.pb"
          }
        ]
      }
    }
  ],
  "realtime": {
    "retention": { "currentEntitiesSeconds": 30, "snapshotsSeconds": 86400 }
  }
}
```

```sh
gtfs realtime refresh --config ./config.json
```

For JavaScript, pass that configuration to `new Gtfs(config)` and call
`await gtfs.realtime.refresh()`. Alternatively, `refreshGtfsRealtime(config)`
opens and closes an instance for one refresh. Both return a `GtfsImportResult`
with validation notices; refresh failures throw an error.
The result includes elapsed time, source outcomes, and complete validation counts
with at most 100 samples in `validation.samples`. GTFS-Realtime sources have empty
`files` arrays because refresh processes protobuf GTFS-Realtime feeds, not Schedule files.

You can also provide GTFS-Realtime feeds and retention for one refresh:

```js
await gtfs.realtime.refresh({
  sources: [
    {
      sourceId: 'metro',
      realtime: {
        feeds: [{ type: 'alerts', url: 'https://example.org/alerts.pb' }],
      },
    },
  ],
  retention: { currentEntitiesSeconds: 60, snapshotsSeconds: 86400 },
  reporting: { level: 'silent' },
});
```

Omitted inputs use instance defaults. Supplied `sources` replace the GTFS-Realtime feed
list for this call; every entry requires an explicit `sourceId` in instance scope.
Old GTFS-Realtime feed headers are not inherited. Retention overrides only the specified
fields, while reporting replaces the complete reporting configuration. Later
no-argument refreshes still use instance defaults. The instance must enable
`gtfs-realtime`; operations cannot change extensions.

Use the same `sourceId` for Schedule and GTFS-Realtime from the same source so
relationship filters can match their identifiers. One source defaults to
`"default"`. Several sources require explicit IDs.

Refresh creates missing enabled tables and checks that existing tables are
compatible. It never rebuilds tables or removes Schedule data.

Schedule replacement clears that source's GTFS-Realtime current records and history.
If replacement happens while a refresh is downloading, the stale response is
discarded with `GTFS_REALTIME_SCHEDULE_CHANGED`; call refresh again. Other
sources are unaffected. This protection also applies to separate instances
and processes using the same database.

## Choose a GTFS-Realtime feed identity

`feedId` identifies one GTFS-Realtime feed within a source. It must remain stable across
refreshes: current-state replacement and deletion use that identity, not just
the URL or the entity ID.

- For one GTFS-Realtime feed per type, set `type`; its value becomes the `feedId`.
- For several GTFS-Realtime feeds of one type, give each a distinct `feedId`.
- For a combined GTFS-Realtime feed, use `type: "mixed"`.
- If you do not know the GTFS-Realtime feed’s entity mix, supply a `feedId` and omit
  `type`. node-GTFS infers the type from the contents.

```json
{
  "feedId": "combined",
  "url": "https://example.org/realtime.pb",
  "requestHeaders": { "Authorization": "Bearer YOUR_TOKEN" },
  "timeoutMs": 30000
}
```

`requestHeaders` are sent only while redirects stay on the same origin (protocol,
hostname, and port). After an origin change, they are removed for the rest of that
download, even if it returns to the original origin. Configure the final trusted
URL directly if it needs authentication. HTTPS-to-HTTP redirects are rejected;
each download attempt allows up to 20 redirects within its `timeoutMs`.

Responses are limited to 64 MiB after HTTP decompression. Set `maxDownloadBytes`
on an individual GTFS-Realtime feed to adjust that limit for a trusted GTFS-Realtime feed. Oversized
responses fail with `GTFS_DOWNLOAD_TOO_LARGE` without retries or snapshot writes;
the previous current state remains available.

Supported type values are `alerts`, `tripUpdates`, `vehiclePositions`,
`shapes`, `stops`, `tripModifications`, and `mixed`. These describe **contents**,
not a requirement that an agency publish a separate URL for each kind.

In particular, Shape and Stop entities can accompany TripUpdates in an
agency’s trip-update GTFS-Realtime feed. They are separate entities in that message, not
Schedule `shapes.txt` or `stops.txt` records. For such a GTFS-Realtime feed, use `mixed`
or a `feedId` without a declared type. Declaring `tripUpdates` alone rejects
other recognized entity kinds with `GTFS_REALTIME_FEED_TYPE_MISMATCH`.

## Query current records

```js
const vehicles = await gtfs.realtime.vehiclePositions
  .where({ route_id: 'red' })
  .all();

const predictions = await gtfs.realtime.tripUpdateStopTimeUpdates
  .where({ stop_id: 'central' })
  .select('trip_update_id', 'stop_id', 'arrival_unix_seconds')
  .all();
```

| Repository under `gtfs.realtime` | Records                                                    |
| -------------------------------- | ---------------------------------------------------------- |
| `alerts`                         | Alert entities, including translated text and images.      |
| `alertEntitySelectors`           | The affected-entity selectors belonging to alerts.         |
| `alertTimeRanges`                | Individual alert communication, impact, and active ranges. |
| `tripUpdates`                    | TripUpdate entities.                                       |
| `tripUpdateStopTimeUpdates`      | Stop-time predictions belonging to TripUpdates.            |
| `vehiclePositions`               | VehiclePosition entities.                                  |
| `shapes`                         | GTFS-Realtime Shape entities.                              |
| `stops`                          | GTFS-Realtime Stop entities.                               |
| `tripModifications`              | TripModifications entities.                                |

Rows retain `source_id` and `realtime_feed_id`. Entity rows use `entity_id`;
child rows also carry their parent identity and, where needed, an ordinal.
Do not join records on an entity ID alone when several sources or GTFS-Realtime feeds exist.

GTFS-Realtime `*_unix_seconds` fields represent instants measured from the Unix
epoch. They are not Schedule `*_service_day_seconds` values. Missing
predictions remain `null`; node-GTFS does not synthesize a full prediction
timetable from a delay.

## Alerts and time ranges

```js
const nowUnixSeconds = Math.floor(Date.now() / 1000);
const alerts = await gtfs.realtime.alerts
  .where({ impactActiveAt: nowUnixSeconds })
  .all();
```

Use `communicationActiveAt` for when an alert should be communicated and
`impactActiveAt` for when service is affected. Ranges include their start and
exclude their end; missing bounds are open-ended. When neither communication
nor impact ranges are supplied, these filters use the alert’s `active_period`.

`alertTimeRanges` exposes `range_kind`, `range_ordinal`, `start_unix_seconds`,
`end_unix_seconds`, and `is_valid`. Invalid ranges produce notices and are not
used for time matching. The original period arrays remain available as JSON
on the alert.

Translated fields, including `image` and `image_alternative_text`, are stored
as JSON text. For example, `JSON.parse(alert.image)` reads the translated image
data when `alert.image !== null`. Image URLs are retained; image files are not
downloaded.

## Refresh behavior and history

Each successfully applied GTFS-Realtime feed is committed independently:

| Message incrementality | Effect on that source and GTFS-Realtime feed’s current records                   |
| ---------------------- | -------------------------------------------------------------------------------- |
| `FULL_DATASET`         | Replace current entities with this response; an empty message clears them.       |
| `DIFFERENTIAL`         | Apply supplied entities and deletions; retain entities absent from the response. |
| Unsupported value      | Retain raw history and issue a notice without applying current-state changes.    |

A deletion is scoped to the GTFS-Realtime feed’s entity identity and removes associated
child records. A failure stops the refresh; successful earlier GTFS-Realtime feeds are
not rolled back.

History is queryable through:

- `gtfs.realtime.persistence.feeds`: GTFS-Realtime feed identities and metadata.
- `gtfs.realtime.persistence.snapshots`: fetched messages and HTTP/header metadata.
- `gtfs.realtime.persistence.feedEntities`: entities within each snapshot,
  including deleted or unsupported entities.

Snapshot IDs are content-based, so repeated identical payloads do not produce
a new history row for every poll. While that snapshot is retained, an identical
payload is not reapplied and does not extend current-record expiration.
`raw_payload` is base64-encoded protobuf;
`raw_payload_encoding` is `"base64"`. Entity JSON is available in `entity_json`.
This history is separate from current-state repositories.

## Skipped entities

Some notices retain raw snapshot history while skipping an unsafe current-state
update:

- `GTFS_REALTIME_ENTITY_ID_MISSING`: the entity has no nonempty ID.
- `GTFS_REALTIME_ENTITY_UNSUPPORTED`: no supported payload could be normalized.
- `GTFS_REALTIME_ENTITY_TYPE_AMBIGUOUS`: the entity has multiple supported payloads.
- `GTFS_REALTIME_TOMBSTONE_AMBIGUOUS`: a differential deletion has multiple payload
  types, so its target cannot be selected safely.
- `GTFS_REALTIME_TOMBSTONE_IN_FULL_DATASET`: `is_deleted` does not act as an
  individual deletion in a full snapshot; full replacement still removes prior rows.

Inspect the notice's entity position and `entity_json` in
`realtime.persistence.feedEntities`, and ask the GTFS-Realtime producer to correct the
identity or payload. A skipped entity in a full snapshot does not preserve its
old current row: the GTFS-Realtime feed's prior current state is replaced. Unsupported
incrementality instead leaves the entire current state unchanged.

## Expiration and cleanup

Retention is configured at `realtime.retention`:

| Setting                  | Default | Effect                                                                   |
| ------------------------ | ------- | ------------------------------------------------------------------------ |
| `currentEntitiesSeconds` | `30`    | Current entities become eligible this many seconds after fetching.       |
| `snapshotsSeconds`       | `86400` | Snapshot/entity history lifetime; `null` means no time-based expiration. |

Use non-negative safe integers in whole seconds. The resulting expiration
timestamp must also be a safe integer. Only `snapshotsSeconds` accepts `null`
for unlimited retention.

**Zero means immediately eligible for cleanup, not “keep forever.”** Choose a
positive current-entity lifetime if you want to retain updates for a period
after their last refresh. Expiration does not itself remove rows or hide them
from queries. Call cleanup explicitly:

```js
const cleanup = await gtfs.realtime.cleanup({
  nowUnixSeconds: Math.floor(Date.now() / 1000),
  currentState: true,
  snapshotHistory: true,
});

console.log(cleanup.totalRowsDeleted, cleanup.deletedRowsByTable);
```

The timestamp defaults to now and both switches default to `true`. Cleanup
respects the instance’s source scope. Its result also includes
`nowUnixSeconds`, `currentStateRowsDeleted`, and `snapshotHistoryRowsDeleted`.
Schedule data is not removed. Changing retention settings does not rewrite
expiration timestamps already stored in history.

## Next steps

- [Look up GTFS-Realtime fields and repositories](reference/gtfs-realtime.md).
- [Query active alerts](query-filters.md#gtfs-realtime-active-periods).
- [Look up GTFS-Realtime relationships](sql-queries.md#joining-related-records).
- [Run refreshes from a scheduled command](cli.md#scripts-and-automation).
- [Handle progress and errors in your application](reporting.md).
- [Investigate stale or missing updates](troubleshooting.md#gtfs-realtime-records-are-stale-or-disappear-during-cleanup).
