import { spawnSync } from 'node:child_process';
import { discoverTests } from './lib/test-files.mjs';

const [layer = 'all', ...options] = process.argv.slice(2);
for (const option of options) {
  if (option !== '--require-databases') {
    throw new Error(`Unknown test option: ${option}`);
  }
}
if (options.includes('--require-databases')) {
  for (const variable of ['GTFS_TEST_POSTGRES_URL', 'GTFS_TEST_MYSQL_URL']) {
    if (!process.env[variable]) {
      throw new Error(
        `${variable} is required for the complete backend contract run`,
      );
    }
  }
}
const files = discoverTests(layer);
const sequential =
  layer === 'contracts' ||
  Boolean(
    process.env.GTFS_TEST_POSTGRES_URL || process.env.GTFS_TEST_MYSQL_URL,
  );
console.log(
  `Running ${files.length} ${layer} test files${sequential ? ' sequentially' : ''}.`,
);
const result = spawnSync(
  process.execPath,
  [
    '--disable-warning=ExperimentalWarning',
    '--test',
    '--test-reporter=spec',
    ...(sequential ? ['--test-concurrency=1'] : []),
    ...files,
  ],
  { stdio: 'inherit' },
);
if (result.error !== undefined) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
