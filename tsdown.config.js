import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/bin/gtfs-export.ts',
    'src/bin/gtfs-import.ts',
    'src/bin/gtfsrealtime-update.ts',
    'src/models/models.ts',
  ],
  clean: true,
  format: ['esm'],
  fixedExtension: false,
  splitting: false,
  sourcemap: true,
  minify: false,
  target: false,
  deps: {
    onlyBundle: false,
  },
  inputOptions: {
    onwarn(warning, warn) {
      if (warning.code === 'SOURCEMAP_BROKEN') return;
      warn(warning);
    },
  },
});
