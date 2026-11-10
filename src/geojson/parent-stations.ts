import type { Stops } from '../schema/row-types.ts';
import { getGeoJSONPosition } from './features.ts';

type StopIdentity = Pick<Stops, 'source_id' | 'stop_id'>;

function stopKey(stop: StopIdentity): string {
  return JSON.stringify([stop.source_id, stop.stop_id]);
}

function isPlatform(stop: Stops): boolean {
  return stop.location_type === null || stop.location_type === 0;
}

function isStationChild(stop: Stops): boolean {
  return (
    isPlatform(stop) ||
    stop.location_type === 2 ||
    stop.location_type === 3 ||
    stop.location_type === 4
  );
}

export async function resolveGeoJSONParentStations({
  stops,
  readStops,
}: {
  readonly stops: readonly Stops[];
  readonly readStops: (identities: readonly StopIdentity[]) => Promise<Stops[]>;
}): Promise<Stops[]> {
  const knownStops = new Map(stops.map((stop) => [stopKey(stop), stop]));
  const requested = new Set(knownStops.keys());
  const children = stops.filter(isStationChild);
  const parentOf = (stop: Stops): Stops | undefined => {
    if (stop.parent_station === null || stop.parent_station === '') {
      return undefined;
    }
    return knownStops.get(
      stopKey({
        source_id: stop.source_id,
        stop_id: stop.parent_station,
      }),
    );
  };
  const readParents = async (locations: readonly Stops[]): Promise<void> => {
    const missing: StopIdentity[] = [];
    for (const stop of locations) {
      if (stop.parent_station === null || stop.parent_station === '') {
        continue;
      }
      const parent = {
        source_id: stop.source_id,
        stop_id: stop.parent_station,
      };
      const key = stopKey(parent);
      if (!requested.has(key)) {
        requested.add(key);
        missing.push(parent);
      }
    }
    if (missing.length > 0) {
      for (const parent of await readStops(missing)) {
        knownStops.set(stopKey(parent), parent);
      }
    }
  };
  await readParents(children);
  // GTFS has at most two parent steps: boarding area -> platform -> station.
  const platforms = children
    .filter((stop) => stop.location_type === 4)
    .map(parentOf)
    .filter((stop): stop is Stops => stop !== undefined && isPlatform(stop));
  await readParents(platforms);

  const resolved = new Map<string, Stops>();
  for (const stop of stops) {
    let parent = isStationChild(stop) ? parentOf(stop) : undefined;
    if (stop.location_type === 4) {
      parent =
        parent !== undefined && isPlatform(parent)
          ? parentOf(parent)
          : undefined;
    }
    const replacement =
      parent?.location_type === 1 &&
      getGeoJSONPosition(parent.stop_lon, parent.stop_lat) !== undefined
        ? parent
        : stop.parent_station === null || stop.parent_station === ''
          ? stop
          : undefined;
    if (replacement !== undefined) {
      resolved.set(stopKey(replacement), replacement);
    }
  }
  return [...resolved.values()];
}
