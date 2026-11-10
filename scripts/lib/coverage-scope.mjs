import { readdirSync } from 'node:fs';
import path from 'node:path';

export const coverageInclude = 'src/**/*.ts';
export const coverageExcludedDirectories = [
  'src/generated/',
  'src/data/',
  'src/types/',
  'src/schema/tables/',
];
export const coverageExcludedFiles = [
  'src/schema/row-types.ts',
  'src/schema/managed-tables.ts',
  'src/schema/database.ts',
];
export const coverageExcludes = [
  ...coverageExcludedDirectories.map((directory) => `${directory}**`),
  ...coverageExcludedFiles,
];

export function createCoverageInventory(lcov, root = process.cwd()) {
  const sourceFiles = readdirSync(path.join(root, 'src'), { recursive: true })
    .filter((filename) => filename.endsWith('.ts'))
    .map((filename) => `src/${filename.split(path.sep).join('/')}`)
    .sort();
  const excluded = (filename) =>
    coverageExcludedFiles.includes(filename) ||
    coverageExcludedDirectories.some((directory) =>
      filename.startsWith(directory),
    );
  const excludedFiles = sourceFiles.filter(excluded);
  const eligibleFiles = sourceFiles.filter((filename) => !excluded(filename));
  const reportedFiles = [
    ...new Set(
      lcov
        .split(/\r?\n/u)
        .filter((line) => line.startsWith('SF:'))
        .map((line) =>
          path
            .relative(root, path.resolve(root, line.slice(3)))
            .split(path.sep)
            .join('/'),
        ),
    ),
  ].sort();
  for (const filename of reportedFiles) {
    if (!eligibleFiles.includes(filename)) {
      throw new Error(`Unexpected file in source coverage: ${filename}`);
    }
  }
  if (reportedFiles.length === 0) {
    throw new Error('No source files were reported by coverage');
  }
  return {
    scope:
      'Source executions reported by Node; not combined source/dist or whole-repository coverage.',
    include: coverageInclude,
    exclude: coverageExcludes,
    eligibleFiles,
    reportedFiles,
    unreportedFiles: eligibleFiles.filter(
      (filename) => !reportedFiles.includes(filename),
    ),
    excludedFiles,
  };
}
