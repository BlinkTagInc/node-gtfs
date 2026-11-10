import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { GTFS_LEGACY_CONFIG_PATHS } from '../src/config/legacy-paths.ts';

const { values } = parseArgs({
  options: {
    'package-directory': { type: 'string', default: process.cwd() },
    'examples-directory': { type: 'string' },
  },
});
const packageDirectory = path.resolve(values['package-directory']);
const guide = await readFile(
  path.join(packageDirectory, 'docs/migrating-to-v5.md'),
  'utf8',
);
const reference = await readFile(
  path.join(packageDirectory, 'docs/reference/v4-api.md'),
  'utf8',
);
const configSection = guide
  .split('<!-- migration-config:start -->')[1]
  ?.split('<!-- migration-config:end -->')[0];
assert.ok(configSection, 'Migration guide is missing its configuration table');
const configRows = [
  ...configSection.matchAll(/^\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|$/gm),
];
const configPaths = new Map(
  configRows.map(([, before, after]) => [before, after]),
);
assert.equal(
  configPaths.size,
  configRows.length,
  'Duplicate configuration migration path',
);
assert.equal(
  configPaths.size,
  GTFS_LEGACY_CONFIG_PATHS.length,
  'Configuration migration table is incomplete',
);
for (const { pattern, replacementPath } of GTFS_LEGACY_CONFIG_PATHS) {
  assert.equal(
    configPaths.get(pattern),
    replacementPath === null
      ? 'Removed without replacement'
      : `\`${replacementPath}\``,
    `Incorrect migration destination for ${pattern}`,
  );
}

if (values['examples-directory'] !== undefined) {
  const directory = path.resolve(values['examples-directory']);
  await mkdir(directory, { recursive: true });
  const getters = reference
    .split('## Getters')[1]
    ?.split('## Lifecycle, operations, and utilities')[0];
  assert.ok(getters, 'Migration getter table is missing');
  const calls = [
    ...getters.matchAll(
      /^\|\s*`get\w+\(\)`\s*\|\s*`(await gtfs\.[^`]+)`\s*\|$/gm,
    ),
  ].map(([, call]) => `${call};`);
  assert.ok(calls.length > 0, 'Migration getter examples are missing');
  await writeFile(
    path.join(directory, 'migration-getters.mts'),
    [
      "import type { Gtfs } from 'gtfs';",
      'declare const gtfs: Gtfs;',
      ...calls,
    ].join('\n'),
  );
  const rowSection = reference
    .split('## Row types')[1]
    ?.split('## Configuration, query, and schema types')[0];
  assert.ok(rowSection, 'Migration row-type table is missing');
  const rowTypes = [
    ...rowSection.matchAll(/^\|\s*`\w+`\s*\|\s*`(\w+)`\s*\|$/gm),
  ].map(([, name]) => name);
  assert.ok(rowTypes.length > 0, 'Migration row types are missing');
  await writeFile(
    path.join(directory, 'migration-rows.mts'),
    `import type { ${[...new Set(rowTypes)].join(', ')} } from 'gtfs';\n`,
  );
  console.log(
    `Wrote ${calls.length} getter calls and ${rowTypes.length} row types`,
  );
}
console.log(
  `Checked ${configPaths.size} documented configuration migration paths`,
);
