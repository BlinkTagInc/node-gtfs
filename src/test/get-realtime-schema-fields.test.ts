import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

import config from './test-config.ts';
import { afterAll, beforeAll, describe, expect, it } from './test-utils.ts';
import {
  closeDb,
  type GtfsRealtimeConfig,
  getServiceAlerts,
  getStopTimeUpdates,
  getTripUpdates,
  getVehiclePositions,
  importGtfs,
  openDb,
  updateGtfsRealtime,
} from '../../dist/index.js';

const { transit_realtime: realtime } = GtfsRealtimeBindings;

function encodeFeed(entity: Record<string, unknown>): Buffer {
  const message = realtime.FeedMessage.fromObject({
    header: {
      gtfsRealtimeVersion: '2.0',
      timestamp: 1_700_000_000,
    },
    entity: [entity],
  });

  return Buffer.from(realtime.FeedMessage.encode(message).finish());
}

const vehicleFeed = encodeFeed({
  id: 'vehicle-position-entity',
  vehicle: {
    trip: {
      tripId: 'trip-vehicle',
      routeId: 'route-vehicle',
      directionId: 1,
      startTime: '08:00:00',
      startDate: '20260816',
      scheduleRelationship: 'CANCELED',
      modifiedTrip: {
        modificationsId: 'modification-vehicle',
        affectedTripId: 'trip-original',
        startTime: '07:45:00',
        startDate: '20260816',
      },
    },
    vehicle: {
      id: 'vehicle-1',
      label: 'Bus 1',
      licensePlate: 'TEST-1',
      wheelchairAccessible: 'WHEELCHAIR_ACCESSIBLE',
    },
    position: {
      latitude: 37.77,
      longitude: -122.42,
      bearing: 135,
      odometer: 12_345.5,
      speed: 8.5,
    },
    currentStopSequence: 7,
    stopId: 'stop-vehicle',
    currentStatus: 'STOPPED_AT',
    timestamp: 1_700_000_100,
    congestionLevel: 'STOP_AND_GO',
    occupancyStatus: 'FEW_SEATS_AVAILABLE',
    occupancyPercentage: 82,
    multiCarriageDetails: [
      {
        id: 'carriage-1',
        label: 'Front',
        occupancyStatus: 'MANY_SEATS_AVAILABLE',
        occupancyPercentage: 30,
        carriageSequence: 1,
      },
    ],
  },
});

const tripUpdateFeed = encodeFeed({
  id: 'trip-update-entity',
  tripUpdate: {
    trip: {
      tripId: 'trip-update',
      routeId: 'route-update',
      directionId: 0,
      startTime: '09:00:00',
      startDate: '20260816',
      scheduleRelationship: 'REPLACEMENT',
      modifiedTrip: {
        modificationsId: 'modification-trip',
        affectedTripId: 'trip-update',
        startTime: '09:00:00',
        startDate: '20260816',
      },
    },
    vehicle: {
      id: 'vehicle-2',
      label: 'Train 2',
      licensePlate: 'TEST-2',
      wheelchairAccessible: 'WHEELCHAIR_INACCESSIBLE',
    },
    stopTimeUpdate: [
      {
        stopSequence: 12,
        stopId: 'stop-update',
        arrival: {
          delay: 60,
          time: 1_700_001_000,
          uncertainty: 15,
          scheduledTime: 1_700_000_940,
        },
        departure: {
          delay: 90,
          time: 1_700_001_100,
          uncertainty: 20,
          scheduledTime: 1_700_001_010,
        },
        departureOccupancyStatus: 'STANDING_ROOM_ONLY',
        scheduleRelationship: 'NO_DATA',
        stopTimeProperties: {
          assignedStopId: 'stop-assigned',
          stopHeadsign: 'Downtown',
          pickupType: 'PHONE_AGENCY',
          dropOffType: 'COORDINATE_WITH_DRIVER',
        },
      },
    ],
    timestamp: 1_700_000_900,
    delay: 45,
    tripProperties: {
      tripId: 'trip-new',
      startDate: '20260817',
      startTime: '10:00:00',
      shapeId: 'shape-new',
      tripHeadsign: 'Uptown',
      tripShortName: 'Express 10',
    },
  },
});

const alertFeed = encodeFeed({
  id: 'alert-entity',
  alert: {
    activePeriod: [{ start: 1_700_002_000, end: 1_700_003_000 }],
    communicationPeriod: [{ start: 1_700_001_500 }],
    impactPeriod: [{ end: 1_700_003_500 }],
    informedEntity: [
      {
        trip: {
          tripId: 'trip-alert',
          routeId: 'route-alert-trip',
          directionId: 1,
          startTime: '11:00:00',
          startDate: '20260816',
          scheduleRelationship: 'SCHEDULED',
          modifiedTrip: {
            modificationsId: 'modification-alert',
            affectedTripId: 'trip-alert',
          },
        },
        routeId: 'route-alert',
        directionId: 0,
      },
    ],
    cause: 'CONSTRUCTION',
    effect: 'DETOUR',
    url: {
      translation: [
        { text: 'https://example.com/en', language: 'en' },
        { text: 'https://example.com/es', language: 'es' },
      ],
    },
    headerText: {
      translation: [
        { text: 'Construction', language: 'en' },
        { text: 'Construcción', language: 'es' },
      ],
    },
    descriptionText: {
      translation: [{ text: 'Route detour', language: 'en' }],
    },
    ttsHeaderText: {
      translation: [{ text: 'Construction alert', language: 'en' }],
    },
    ttsDescriptionText: {
      translation: [{ text: 'The route is detoured', language: 'en' }],
    },
    severityLevel: 'WARNING',
    image: {
      localizedImage: [
        {
          url: 'https://example.com/detour.png',
          mediaType: 'image/png',
          language: 'en',
        },
      ],
    },
    imageAlternativeText: {
      translation: [{ text: 'Map of the detour', language: 'en' }],
    },
    causeDetail: {
      translation: [{ text: 'Bridge construction', language: 'en' }],
    },
    effectDetail: {
      translation: [{ text: 'Uses Main Street', language: 'en' }],
    },
  },
});

describe('GTFS-Realtime schema field storage', () => {
  let realtimeConfig: GtfsRealtimeConfig;
  let originalFetch: typeof fetch;

  beforeAll(async () => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString();
      const payload = url.endsWith('/alerts')
        ? alertFeed
        : url.endsWith('/trip-updates')
          ? tripUpdateFeed
          : vehicleFeed;
      return new Response(payload, {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    }) as typeof fetch;

    realtimeConfig = {
      gtfsRealtimeExpirationSeconds: 3600,
      sqlitePath: ':memory:',
      agencies: [
        {
          realtimeAlerts: { url: 'https://example.test/alerts' },
          realtimeTripUpdates: {
            url: 'https://example.test/trip-updates',
          },
          realtimeVehiclePositions: {
            url: 'https://example.test/vehicle-positions',
          },
        },
      ],
    };

    openDb(realtimeConfig);
    await importGtfs({ ...config, sqlitePath: ':memory:' });
    await updateGtfsRealtime(realtimeConfig);
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    closeDb(openDb(realtimeConfig));
  });

  it('stores all supported vehicle-position fields using protobuf paths', () => {
    const [vehicle] = getVehiclePositions({ id: 'vehicle-position-entity' });

    expect(vehicle.route_id).toBe('route-vehicle');
    expect(vehicle.direction_id).toBe(1);
    expect(vehicle.stop_id).toBe('stop-vehicle');
    expect(vehicle.current_status).toBe('STOPPED_AT');
    expect(vehicle.odometer).toBe(12_345.5);
    expect(vehicle.vehicle_wheelchair_accessible).toBe('WHEELCHAIR_ACCESSIBLE');
    expect(vehicle.timestamp).toBe(1_700_000_100);
    expect(vehicle.modified_trip_modifications_id).toBe('modification-vehicle');
    expect(JSON.parse(vehicle.multi_carriage_details ?? '[]')).toHaveLength(1);
  });

  it('stores trip properties and complete stop-time events', () => {
    const [tripUpdate] = getTripUpdates({ id: 'trip-update-entity' });
    const [stopTimeUpdate] = getStopTimeUpdates({
      trip_update_id: 'trip-update-entity',
    });

    expect(tripUpdate.delay).toBe(45);
    expect(tripUpdate.vehicle_label).toBe('Train 2');
    expect(tripUpdate.trip_properties_trip_id).toBe('trip-new');
    expect(tripUpdate.trip_properties_shape_id).toBe('shape-new');
    expect(stopTimeUpdate.arrival_uncertainty).toBe(15);
    expect(stopTimeUpdate.arrival_scheduled_timestamp).toBe(1_700_000_940);
    expect(stopTimeUpdate.departure_uncertainty).toBe(20);
    expect(stopTimeUpdate.departure_occupancy_status).toBe(
      'STANDING_ROOM_ONLY',
    );
    expect(stopTimeUpdate.assigned_stop_id).toBe('stop-assigned');
    expect(stopTimeUpdate.pickup_type).toBe('PHONE_AGENCY');
  });

  it('retains alert periods, translations, images, and selector trip fields', () => {
    const [alert] = getServiceAlerts({ id: 'alert-entity' });
    const [informedEntity] = alert.informed_entities;

    expect(JSON.parse(alert.communication_period ?? '[]')).toHaveLength(1);
    expect(JSON.parse(alert.impact_period ?? '[]')).toHaveLength(1);
    expect(JSON.parse(alert.header_text_translations ?? '[]')).toHaveLength(2);
    expect(JSON.parse(alert.image ?? '{}').localizedImage).toHaveLength(1);
    expect(alert.image_alternative_text).toBe('Map of the detour');
    expect(alert.cause_detail).toBe('Bridge construction');
    expect(alert.effect_detail).toBe('Uses Main Street');
    expect(informedEntity.trip_route_id).toBe('route-alert-trip');
    expect(informedEntity.trip_direction_id).toBe(1);
    expect(informedEntity.trip_start_date).toBe('20260816');
    expect(informedEntity.trip_modified_trip_modifications_id).toBe(
      'modification-alert',
    );
  });
});
