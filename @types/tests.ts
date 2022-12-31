import {
  Config,
  exportGtfs,
  getAgencies,
  getShapesAsGeoJSON,
  importGtfs,
  openDb,
} from 'gtfs';

/**
 * This is type-checked (but not executed) by dtslint.
 * `npm run dtslint`
 */

(async () => {
  const config: Config = {
    agencies: [{ path: 'example.zip' }],
    verbose: false,
  };

  await importGtfs(config); // $ExpectType void

  await exportGtfs(config); // $ExpectType void

  openDb(config); // $ExpectType Database

  const results = getAgencies();
  results[0]; // $ExpectType Record<string, any>

  getShapesAsGeoJSON(); // $ExpectType FeatureCollection<Geometry, { [name: string]: any; }>
})();
