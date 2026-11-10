/**
 * Generates the typed instance repository surface from the compiled schema
 * manifest. Called by `pnpm repositories:generate`; `--check` is used by
 * `pnpm repositories:check` and `pnpm test` to detect stale generated output.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

import { compiledTableRegistry } from '../src/schema/table-registry.ts';
import { repositoryQueryExtensions } from '../src/schema/repository-query-extensions.ts';

const outputUrl = new URL('../src/generated/repositories.ts', import.meta.url);
const check = process.argv.includes('--check');
const reservedProperties = new Set([
  'close',
  'database',
  'export',
  'extensions',
  'geojson',
  'query',
  'import',
  'isClosed',
  'reporting',
  'realtime',
  'schema',
  'sourceIds',
]);
const sharedRepositoryNamespaces = new Map([['realtime', 'gtfs-realtime']]);
const reservedRepositoryPaths = new Set([
  'realtime.cleanup',
  'realtime.refresh',
]);
const namespaceBySpecification = {
  'gtfs-schedule': 'schedule',
  'gtfs-realtime': 'realtime',
  'gtfs-plus': 'gtfsPlus',
  'gtfs-ride': 'gtfsRide',
  'gtfs-to-html': 'gtfsToHtml',
  tods: 'tods',
  'tods-v1': 'todsV1',
  tides: 'tides',
};
const interfaceNameBySpecification = {
  'gtfs-schedule': 'GtfsScheduleRepositories',
  'gtfs-realtime': 'GtfsRealtimeRepositories',
  'gtfs-plus': 'GtfsPlusRepositories',
  'gtfs-ride': 'GtfsRideRepositories',
  'gtfs-to-html': 'GtfsToHtmlRepositories',
  tods: 'TodsRepositories',
  'tods-v1': 'TodsV1Repositories',
  tides: 'TidesRepositories',
};
const realtimeRepositoryPaths = {
  alertEntitySelectors: ['realtime', 'alertEntitySelectors'],
  alertTimeRanges: ['realtime', 'alertTimeRanges'],
  alerts: ['realtime', 'alerts'],
  realtimeFeedEntities: ['realtime', 'persistence', 'feedEntities'],
  realtimeFeeds: ['realtime', 'persistence', 'feeds'],
  realtimeShapes: ['realtime', 'shapes'],
  realtimeSnapshots: ['realtime', 'persistence', 'snapshots'],
  realtimeStops: ['realtime', 'stops'],
  tripModifications: ['realtime', 'tripModifications'],
  tripUpdateStopTimeUpdates: ['realtime', 'tripUpdateStopTimeUpdates'],
  tripUpdates: ['realtime', 'tripUpdates'],
  vehiclePositions: ['realtime', 'vehiclePositions'],
};
function lowerCamelCaseTableName(tableName) {
  return tableName.replace(/_([a-z\d])/g, (_match, character) =>
    character.toUpperCase(),
  );
}

function fileRepositoryProperty(filename) {
  return lowerCamelCaseTableName(
    filename.replace(/\.(?:txt|csv|geojson)$/u, ''),
  );
}

const definitions = Object.entries(compiledTableRegistry).map(
  ([registryKey, table]) => {
    const namespace = namespaceBySpecification[table.specification];
    if (namespace === undefined) {
      throw new Error(
        `Table ${table.tableName} uses unregistered GTFS specification ${table.specification}`,
      );
    }
    const propertyPath =
      table.specification === 'gtfs-realtime'
        ? realtimeRepositoryPaths[registryKey]
        : table.filename === null
          ? undefined
          : [namespace, fileRepositoryProperty(table.filename)];
    if (propertyPath === undefined) {
      throw new Error(
        `Table ${table.tableName} has no generated repository property path`,
      );
    }
    return {
      specification: table.specification,
      registryKey,
      tableName: table.tableName,
      propertyPath,
    };
  },
);

for (const [registryKey, table] of Object.entries(compiledTableRegistry)) {
  const expectedRegistryKey = lowerCamelCaseTableName(table.tableName);
  if (registryKey !== expectedRegistryKey) {
    throw new Error(
      `Table ${table.tableName} must use registry key ${expectedRegistryKey}, received ${registryKey}`,
    );
  }
  if (table.filename !== null) {
    const expectedTableName = table.filename.replace(
      /\.(?:txt|csv|geojson)$/u,
      '',
    );
    const storageName =
      table.specification === 'tods' && expectedTableName === 'vehicles'
        ? 'tods_vehicles'
        : expectedTableName;
    if (table.tableName !== storageName) {
      throw new Error(
        `File ${table.filename} must use SQL table ${expectedTableName}, received ${table.tableName}`,
      );
    }
  }
}
function assertLibraryQueryName(name, kind, tableName) {
  if (!/^[a-z][A-Za-z\d]*$/u.test(name)) {
    throw new Error(
      `Library-defined ${kind} ${tableName}.${name} must use lower camelCase`,
    );
  }
}

const namespaceProperties = Object.values(namespaceBySpecification);
if (new Set(namespaceProperties).size !== namespaceProperties.length) {
  throw new Error('Repository extension namespaces must be unique');
}
for (const [specification, namespace] of Object.entries(
  namespaceBySpecification,
)) {
  if (
    reservedProperties.has(namespace) &&
    sharedRepositoryNamespaces.get(namespace) !== specification
  ) {
    throw new Error(
      `Repository namespace ${namespace} collides with a Gtfs instance property`,
    );
  }
}
function pathsOverlap(left, right) {
  return (
    left === right ||
    left.startsWith(`${right}.`) ||
    right.startsWith(`${left}.`)
  );
}
const generatedPaths = new Map();
for (const { propertyPath, tableName } of definitions) {
  const path = propertyPath.join('.');
  for (const reservedPath of reservedRepositoryPaths) {
    if (pathsOverlap(path, reservedPath)) {
      throw new Error(
        `Repository path ${path} collides with Gtfs instance operation ${reservedPath}`,
      );
    }
  }
  for (const [existingPath, existingTable] of generatedPaths) {
    if (pathsOverlap(path, existingPath)) {
      throw new Error(
        `Repository path ${path} collides with ${existingPath} for tables ${existingTable} and ${tableName}`,
      );
    }
  }
  generatedPaths.set(path, tableName);
}
for (const tableName of Object.keys(repositoryQueryExtensions)) {
  if (!definitions.some((definition) => definition.tableName === tableName)) {
    throw new Error(`Query extensions reference unknown table ${tableName}`);
  }
  for (const field of Object.keys(repositoryQueryExtensions[tableName])) {
    assertLibraryQueryName(field, 'semantic filter', tableName);
  }
}
function repositoryType({ tableName }) {
  return `GtfsRepository<'${tableName}'>`;
}

function namespacePropertiesFor(specification) {
  return definitions
    .filter(
      (definition) =>
        definition.specification === specification &&
        definition.propertyPath.length === 2,
    )
    .map(
      (definition) =>
        `  readonly ${definition.propertyPath[1]}: ${repositoryType(definition)};`,
    )
    .join('\n');
}

const namespaceInterfaces = Object.entries(interfaceNameBySpecification)
  .filter(([specification]) => specification !== 'gtfs-realtime')
  .map(
    ([specification, interfaceName]) =>
      `/** Repositories for the ${specification} specification. */\nexport interface ${interfaceName} {\n${namespacePropertiesFor(specification)}\n}`,
  )
  .join('\n\n');

const realtimeProperties = namespacePropertiesFor('gtfs-realtime');
const realtimePersistenceProperties = definitions
  .filter(({ propertyPath }) => propertyPath.length === 3)
  .map(
    (definition) =>
      `  readonly ${definition.propertyPath[2]}: ${repositoryType(definition)};`,
  )
  .join('\n');

const runtimeDefinitions = definitions
  .map(
    ({ registryKey, propertyPath }) =>
      `  { propertyPath: ${JSON.stringify(propertyPath)}, registryKey: '${registryKey}' },`,
  )
  .join('\n');

const rawOutput = `// This file is generated by scripts/generate-repositories.mjs.
// Do not edit it directly.

import type {
  GtfsRepository,
} from '../query/repository.ts';

/** GTFS Realtime feed and immutable snapshot persistence repositories. */
export interface GtfsRealtimePersistenceRepositories {
${realtimePersistenceProperties}
}

/** Current GTFS Realtime entities, query children, and persistence records. */
export interface GtfsRealtimeRepositories {
${realtimeProperties}
  readonly persistence: GtfsRealtimePersistenceRepositories;
}

${namespaceInterfaces}

/** Typed specification namespace for every table in the schema registry. */
export interface GtfsRepositoryProperties {
${Object.entries(namespaceBySpecification)
  .map(
    ([specification, namespace]) =>
      `  readonly ${namespace}: ${interfaceNameBySpecification[specification]};`,
  )
  .join('\n')}
}

/** Runtime table/property pairs generated from the same registry. */
export const generatedRepositoryDefinitions = [
${runtimeDefinitions}
] as const;
`;
const output = await format(rawOutput, {
  filepath: fileURLToPath(outputUrl),
  singleQuote: true,
});

async function emitGeneratedFile(url, contents) {
  if (!check) {
    await writeFile(url, contents);
    return;
  }

  let current;
  try {
    current = await readFile(url, 'utf8');
  } catch {
    current = null;
  }
  if (current !== contents) {
    console.error(
      `${fileURLToPath(url)} is stale; run pnpm repositories:generate`,
    );
    process.exitCode = 1;
  }
}

await emitGeneratedFile(outputUrl, output);
if (!check) {
  console.log(`Generated ${definitions.length} repositories`);
}
