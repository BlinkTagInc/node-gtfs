import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import { createServer, type Server } from 'node:http';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

import config from './test-config.ts';
import {
  type Config,
  openDb,
  closeDb,
  importGtfs,
  updateGtfsRealtime,
  getStopTimeUpdates,
} from '../../dist/index.js';

const FIXTURE_TRIP_ID = 'realtime-test-trip-1';

/*
 * Builds an encoded GTFS-Realtime FeedMessage protobuf payload containing a
 * single TripUpdate entity with the given stop-time-updates.  Omitting
 * arrivalDelay for a stop exercises the NULL arrival_delay path.
 */
function buildFeedBuffer(
  stops: {
    stopId: string;
    stopSequence: number;
    arrivalDelay?: number;
    departureDelay: number;
  }[],
): Buffer {
  const { transit_realtime } = GtfsRealtimeBindings;

  const message = transit_realtime.FeedMessage.fromObject({
    header: {
      gtfsRealtimeVersion: '2.0',
      timestamp: Math.floor(Date.now() / 1000),
    },
    entity: [
      {
        id: 'entity-1',
        tripUpdate: {
          trip: { tripId: FIXTURE_TRIP_ID },
          stopTimeUpdate: stops.map((s) => ({
            stopSequence: s.stopSequence,
            stopId: s.stopId,
            ...(s.arrivalDelay !== undefined
              ? { arrival: { delay: s.arrivalDelay } }
              : {}),
            departure: { delay: s.departureDelay },
          })),
        },
      },
    ],
  });

  return Buffer.from(transit_realtime.FeedMessage.encode(message).finish());
}

// First poll: delays 30 / 60 / 90; stop-Z has no arrival (tests NULL field)
const POLL_1_STOPS = [
  { stopId: 'stop-X', stopSequence: 1, arrivalDelay: 30, departureDelay: 30 },
  { stopId: 'stop-Y', stopSequence: 2, arrivalDelay: 60, departureDelay: 60 },
  { stopId: 'stop-Z', stopSequence: 3, departureDelay: 90 },
];

// Second poll: same trip / stops but updated delays (120 / 150 / 180)
const POLL_2_STOPS = [
  { stopId: 'stop-X', stopSequence: 1, arrivalDelay: 120, departureDelay: 120 },
  { stopId: 'stop-Y', stopSequence: 2, arrivalDelay: 150, departureDelay: 150 },
  { stopId: 'stop-Z', stopSequence: 3, departureDelay: 180 },
];

describe('getStopTimeUpdates():', () => {
  let server: Server;
  let realtimeConfig: Config;
  let feedBuffer: Buffer;

  beforeAll(async () => {
    feedBuffer = buildFeedBuffer(POLL_1_STOPS);

    server = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      response.end(feedBuffer);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const { port } = server.address() as { port: number };

    // Use a long expiration so rows are not removed by the expiry sweep
    // between polls — this forces the no-duplicates behavior to rely on the
    // per-trip delete rather than on expiration cleanup.
    realtimeConfig = {
      ...config,
      gtfsRealtimeExpirationSeconds: 3600,
      sqlitePath: ':memory:',
      agencies: [
        {
          ...config.agencies[0],
          realtimeTripUpdates: {
            url: `http://127.0.0.1:${port}/trip-updates`,
          },
        },
      ],
    };

    // Use a static-only config (no realtime URLs) for importGtfs so that
    // importGtfs does not fetch the realtime feed internally. This ensures
    // stop_time_updates is empty until updateGtfsRealtime is called explicitly.
    const staticConfig = {
      ...config,
      sqlitePath: ':memory:',
    };

    openDb(realtimeConfig);
    await importGtfs(staticConfig);
  });

  afterAll(async () => {
    const db = openDb(realtimeConfig);
    closeDb(db);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('should return an empty array when the table is empty', () => {
    const results = getStopTimeUpdates();
    expect(results).toHaveLength(0);
  });

  it('should return an empty array for a non-existent trip_id', () => {
    const results = getStopTimeUpdates({ trip_id: 'nonexistent-trip-id' });
    expect(results).toHaveLength(0);
  });

  it('should return all 3 stops for a trip after import, including a NULL arrival_delay', async () => {
    await updateGtfsRealtime(realtimeConfig);

    const results = getStopTimeUpdates({ trip_id: FIXTURE_TRIP_ID });
    expect(results).toHaveLength(3);

    const stopIds = results.map((r) => r.stop_id).sort();
    expect(stopIds).toEqual(['stop-X', 'stop-Y', 'stop-Z']);

    // stop-Z has no arrival in the feed, so arrival_delay must be NULL
    const stopZ = results.find((r) => r.stop_id === 'stop-Z');
    expect(stopZ?.arrival_delay).toBeNull();
  });

  it('should return all stop_time_updates when called with no arguments', async () => {
    await updateGtfsRealtime(realtimeConfig);

    const results = getStopTimeUpdates();
    expect(results).toHaveLength(3);
  });

  it('should return only specified fields when the fields argument is provided', async () => {
    await updateGtfsRealtime(realtimeConfig);

    const results = getStopTimeUpdates({ trip_id: FIXTURE_TRIP_ID }, [
      'stop_id',
    ]);
    expect(results).toHaveLength(3);
    for (const row of results) {
      expect(Object.keys(row)).toEqual(['stop_id']);
    }
  });

  it('should not accumulate duplicate rows after a second import', async () => {
    await updateGtfsRealtime(realtimeConfig);
    expect(getStopTimeUpdates({ trip_id: FIXTURE_TRIP_ID })).toHaveLength(3);

    // Switch the server to return updated predictions and re-import
    feedBuffer = buildFeedBuffer(POLL_2_STOPS);
    await updateGtfsRealtime(realtimeConfig);

    const results = getStopTimeUpdates({ trip_id: FIXTURE_TRIP_ID });

    // Row count must still be 3, not 6 — the refresh replaced the trip's rows
    expect(results).toHaveLength(3);

    // Values must reflect the second poll, not the first
    const stopX = results.find((r) => r.stop_id === 'stop-X');
    expect(stopX?.arrival_delay).toBe(120);
  });
});
