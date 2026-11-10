import { readdirSync } from 'node:fs';
import path from 'node:path';

export const testLayers = ['unit', 'contracts', 'integration', 'package'];

/** Discover runtime tests explicitly, independent of shell glob expansion. */
export function discoverTests(layer = 'all', directory = 'test') {
  if (layer !== 'all' && !testLayers.includes(layer)) {
    throw new Error(`Unknown test layer: ${layer}`);
  }
  const files = readdirSync(directory, { recursive: true })
    .filter((filename) => filename.endsWith('.test.ts'))
    .sort();
  for (const filename of files) {
    if (!testLayers.includes(filename.split(path.sep)[0])) {
      throw new Error(`Runtime test is outside a test layer: ${filename}`);
    }
  }
  const selected = files.filter(
    (filename) => layer === 'all' || filename.startsWith(`${layer}${path.sep}`),
  );
  if (selected.length === 0) {
    throw new Error(`No tests found for layer: ${layer}`);
  }
  return selected.map((filename) => path.join(directory, filename));
}
