import Database from 'better-sqlite3';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

import config from './test-config.ts';
import { describe, expect, it } from './test-utils.ts';
import {
  closeDb,
  importGtfs,
  openDb,
  updateGtfsRealtime,
} from '../../dist/index.js';

const { transit_realtime: realtime } = GtfsRealtimeBindings;

describe('GTFS-Realtime reporting', () => {
  it('should send batch failures through logFunction', async () => {
    const db = openDb();
    const originalFetch = globalThis.fetch;
    const databasePrototype = Database.prototype as unknown as {
      transaction: (...args: unknown[]) => (...args: unknown[]) => unknown;
    };
    const originalTransaction = databasePrototype.transaction;
    const messages: Array<{
      level: string | undefined;
      message: string;
    }> = [];

    try {
      await importGtfs(config);

      const message = realtime.FeedMessage.fromObject({
        header: { gtfsRealtimeVersion: '2.0' },
        entity: [
          {
            id: 'vehicle-position-entity',
            vehicle: {
              vehicle: { id: 'vehicle-1' },
              position: { latitude: 37.77, longitude: -122.42 },
            },
          },
        ],
      });
      const payload = Buffer.from(
        realtime.FeedMessage.encode(message).finish(),
      );
      globalThis.fetch = (async () =>
        new Response(payload, { status: 200 })) as typeof fetch;

      let transactionCount = 0;
      databasePrototype.transaction = function (...args: unknown[]) {
        transactionCount += 1;
        const transaction = originalTransaction.apply(this, args);

        if (transactionCount === 2) {
          return () => {
            throw new Error('simulated batch failure');
          };
        }

        return transaction;
      };

      await updateGtfsRealtime({
        agencies: [
          {
            realtimeVehiclePositions: {
              url: 'https://example.test/vehicle-positions',
            },
          },
        ],
        logLevel: 'error',
        logFunction(messageText, level) {
          messages.push({ level, message: messageText });
        },
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].level).toBe('error');
      expect(messages[0].message).toMatch(
        'Batch processing error: simulated batch failure',
      );
    } finally {
      databasePrototype.transaction = originalTransaction;
      globalThis.fetch = originalFetch;
      closeDb(db);
    }
  });
});
