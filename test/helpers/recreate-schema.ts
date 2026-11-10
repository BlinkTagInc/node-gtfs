import { Gtfs, type GtfsInstanceOptions } from '../../src/index.ts';

export async function recreateTestSchema<DB>(
  options: Pick<GtfsInstanceOptions<DB>, 'database' | 'extensions'>,
): Promise<void> {
  const gtfs = new Gtfs({ ...options, reporting: { level: 'silent' } });
  try {
    await gtfs.schema.recreate();
  } finally {
    await gtfs.close();
  }
}
