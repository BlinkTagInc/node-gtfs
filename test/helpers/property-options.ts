/** Fixed defaults keep CI reproducible; fast-check failures print seed and path. */
export function propertyOptions(seed: number, numRuns: number) {
  const override = process.env.GTFS_PROPERTY_SEED;
  const path = process.env.GTFS_PROPERTY_PATH;
  if (override !== undefined) {
    if (!/^-?\d+$/u.test(override) || !Number.isSafeInteger(Number(override))) {
      throw new Error('GTFS_PROPERTY_SEED must be an integer');
    }
    seed = Number(override);
    if (seed < -2_147_483_648 || seed > 2_147_483_647) {
      throw new Error('GTFS_PROPERTY_SEED must fit in a signed 32-bit integer');
    }
  }
  if (path !== undefined && override === undefined) {
    throw new Error('GTFS_PROPERTY_PATH also requires GTFS_PROPERTY_SEED');
  }
  return { seed, numRuns, ...(path === undefined ? {} : { path }) };
}
