/**
 * Runs the complete test suite and reports source-import coverage only.
 * Called by `pnpm test:coverage`; test fixtures, generated code, declarative
 * table definitions, compile-only assertions, and built output are excluded.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { discoverTests } from './lib/test-files.mjs';
import {
  coverageInclude,
  coverageExcludes,
  createCoverageInventory,
} from './lib/coverage-scope.mjs';

console.log(
  'Source coverage: unit, integration, and backend contracts import src. Package/CLI checks also run, but dist execution is not mapped to src. Percentages describe reported source files, not the whole repository.',
);
const testFiles = discoverTests();
const directory = path.resolve('internal/coverage');
const lcovPath = path.join(directory, 'source.lcov');
const inventoryPath = path.join(directory, 'source-inventory.json');
mkdirSync(directory, { recursive: true });
// A failed launch must not leave an older report looking like a current result.
rmSync(lcovPath, { force: true });
rmSync(inventoryPath, { force: true });

const result = spawnSync(
  process.execPath,
  [
    '--disable-warning=ExperimentalWarning',
    '--test',
    '--test-concurrency=1',
    '--experimental-test-coverage',
    `--test-coverage-include=${coverageInclude}`,
    ...coverageExcludes.map((pattern) => `--test-coverage-exclude=${pattern}`),
    '--test-reporter=spec',
    '--test-reporter-destination=stdout',
    '--test-reporter=lcov',
    `--test-reporter-destination=${lcovPath}`,
    ...testFiles,
  ],
  { stdio: 'inherit' },
);

if (result.error !== undefined) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
const inventory = {
  ...createCoverageInventory(readFileSync(lcovPath, 'utf8')),
  nodeVersion: process.version,
  testExitCode: process.exitCode,
  configuredBackends: {
    sqlite: true,
    postgres: Boolean(process.env.GTFS_TEST_POSTGRES_URL),
    mysql: Boolean(process.env.GTFS_TEST_MYSQL_URL),
  },
};
writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`Coverage artifacts: ${lcovPath} and ${inventoryPath}`);
console.log(
  `${inventory.reportedFiles.length} source files reported; ${inventory.unreportedFiles.length} eligible source files absent from the report. See the inventory before interpreting totals.`,
);
