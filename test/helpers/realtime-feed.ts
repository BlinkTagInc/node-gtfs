import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

export function encodeRealtimeFeed({
  incrementality,
  timestamp,
  entities,
}: {
  readonly incrementality: 'FULL_DATASET' | 'DIFFERENTIAL' | number;
  readonly timestamp: number;
  readonly entities: readonly Record<string, unknown>[];
}): Buffer {
  const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;
  return Buffer.from(
    FeedMessage.encode(
      FeedMessage.fromObject({
        header: { gtfsRealtimeVersion: '2.0', incrementality, timestamp },
        entity: entities,
      }),
    ).finish(),
  );
}
