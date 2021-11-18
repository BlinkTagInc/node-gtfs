import { Config, exportGtfs, getAgencies, getDb, getShapesAsGeoJSON, importGtfs, openDb } from "gtfs";

/**
 * This is type-checked (but not executed) by dtslint.
 * `npm run dtslint`
 */

(async () => {
    const config: Config = {
        agencies: [{ path: "example.zip" }],
        verbose: false,
    };

    await importGtfs(config); // $ExpectType void

    await exportGtfs(config); // $ExpectType void

    await openDb(config); // $ExpectType Database<Database, Statement>

    await getDb(); // $ExpectType Database<Database, Statement>

    const results = await getAgencies();
    results[0]; // $ExpectType Record<string, any>

    await getShapesAsGeoJSON(); // $ExpectType FeatureCollection<Geometry, { [name: string]: any; }>
})();
