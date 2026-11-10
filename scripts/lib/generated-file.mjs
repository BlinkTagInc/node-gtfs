/**
 * Writes or checks deterministic generated artifacts. Used by the schema and
 * field-reference generators; check mode never creates directories or files.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function writeGeneratedFile(url, contents, { check }) {
  const filename = fileURLToPath(url);
  let existing;
  try {
    existing = await readFile(url, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  if (existing === contents) {
    return;
  }
  if (check) {
    console.error(
      `Generated file is missing or stale: ${path.relative(process.cwd(), filename)}. Run pnpm generated:generate.`,
    );
    process.exitCode = 1;
    return;
  }
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(url, contents);
}
