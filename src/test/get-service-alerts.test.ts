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
  getServiceAlerts,
} from '../../dist/index.js';

const ALERT_ID = 'test-alert-1';

/*
 * Builds an encoded GTFS-Realtime FeedMessage protobuf payload containing a
 * single service alert with three informed entities, one of which is a
 * route-only entity (stop_id and trip_id are NULL) to exercise the NULL path.
 */
function buildAlertFeedBuffer(): Buffer {
  const { transit_realtime } = GtfsRealtimeBindings;

  const message = transit_realtime.FeedMessage.fromObject({
    header: {
      gtfsRealtimeVersion: '2.0',
      timestamp: Math.floor(Date.now() / 1000),
    },
    entity: [
      {
        id: ALERT_ID,
        alert: {
          activePeriod: [{ start: 1000, end: 2000 }],
          headerText: { translation: [{ text: 'Test alert header' }] },
          descriptionText: {
            translation: [{ text: 'Test alert description' }],
          },
          informedEntity: [
            // Stop + route specific entity
            { stopId: 'stop-A', routeId: 'route-1' },
            // Trip + route_type specific entity
            { trip: { tripId: 'trip-9' }, routeType: 3 },
            // Route-only entity (stop_id and trip_id are NULL)
            { routeId: 'route-7' },
          ],
        },
      },
    ],
  });

  return Buffer.from(transit_realtime.FeedMessage.encode(message).finish());
}

describe('getServiceAlerts():', () => {
  let server: Server;
  let realtimeConfig: Config;

  beforeAll(async () => {
    const feedBuffer = buildAlertFeedBuffer();

    server = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      response.end(feedBuffer);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const { port } = server.address() as { port: number };

    realtimeConfig = {
      ...config,
      // Use a long expiration so rows are not removed by the expiry sweep
      // between polls — this forces the no-duplicates behavior to rely on the
      // per-alert delete rather than on expiration cleanup.
      gtfsRealtimeExpirationSeconds: 3600,
      sqlitePath: ':memory:',
      agencies: [
        {
          ...config.agencies[0],
          realtimeAlerts: {
            url: `http://127.0.0.1:${port}/alerts`,
          },
        },
      ],
    };

    openDb(realtimeConfig);
    // Fresh import to (re)create tables with the current schema.
    await importGtfs(realtimeConfig);
  });

  afterAll(async () => {
    const db = openDb(realtimeConfig);
    closeDb(db);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('should return one alert with nested informed_entities', async () => {
    await updateGtfsRealtime(realtimeConfig);

    const results = getServiceAlerts({ id: ALERT_ID });

    // One alert object, not one row per informed entity
    expect(results).toHaveLength(1);

    const alert = results[0];
    expect(alert.id).toBe(ALERT_ID);
    expect(alert.header_text).toBe('Test alert header');
    expect(alert.description_text).toBe('Test alert description');

    // All three informed entities nested under the alert
    expect(alert.informed_entities).toHaveLength(3);

    const stopRouteEntity = alert.informed_entities.find(
      (e) => e.stop_id === 'stop-A',
    );
    expect(stopRouteEntity).toBeDefined();
    expect(stopRouteEntity?.route_id).toBe('route-1');

    const tripEntity = alert.informed_entities.find(
      (e) => e.trip_id === 'trip-9',
    );
    expect(tripEntity).toBeDefined();
    expect(tripEntity?.route_type).toBe(3);

    const routeOnlyEntity = alert.informed_entities.find(
      (e) =>
        e.route_id === 'route-7' && e.stop_id === null && e.trip_id === null,
    );
    expect(routeOnlyEntity).toBeDefined();
  });

  it('should not accumulate duplicate results across refreshes', async () => {
    // Simulate a second refresh poll of the same feed.
    await updateGtfsRealtime(realtimeConfig);

    const results = getServiceAlerts({ id: ALERT_ID });

    // Still one alert with exactly three informed entities
    expect(results).toHaveLength(1);
    expect(results[0].informed_entities).toHaveLength(3);
  });
});
