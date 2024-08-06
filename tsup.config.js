import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/bin/gtfs-export.ts',
    'src/bin/gtfs-import.ts',
    'src/bin/gtfsrealtime-update.ts',
    'src/models/models.ts',
  ],
  dts: true,
  clean: true,
  format: ['esm'],
  splitting: false,
  sourcemap: true,
  minify: false,
});
