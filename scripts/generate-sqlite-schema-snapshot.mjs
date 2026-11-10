/**
 * Rebuilds the checked-in SQLite v5 schema snapshot from source definitions.
 * Called by `pnpm schema:snapshot:sqlite` when schema definitions or DDL
 * generation change; the test suite verifies the resulting snapshot.
 */
import { createSqliteSchemaSnapshot } from './lib/schema-snapshots.mjs';
import { writeGeneratedFile } from './lib/generated-file.mjs';

const outputPath = new URL(
  '../test/fixtures/sqlite-schema.json',
  import.meta.url,
);

await writeGeneratedFile(
  outputPath,
  `${JSON.stringify(createSqliteSchemaSnapshot(), null, 2)}\n`,
  { check: process.argv.includes('--check') },
);
