import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/bin/gtfs-export.ts',
    'src/bin/gtfs-import.ts',
    'src/bin/gtfsrealtime-update.ts',
  ],
  dts: true,
  clean: true,
  format: ['esm'],
  splitting: false,
  sourcemap: true,
  minify: false,
});
