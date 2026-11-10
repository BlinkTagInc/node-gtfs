import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/sqlite.ts',
    'src/kysely.ts',
    'src/bin/gtfs.ts',
    'src/schema/index.ts',
  ],
  outDir: 'dist',
  clean: true,
  platform: 'node',
  target: 'node22.18',
  format: 'esm',
  fixedExtension: false,
  dts: true,
  sourcemap: true,
  nodeProtocol: true,
  failOnWarn: 'ci-only',
  suppressWarnings: [
    // The TypeScript 7.1 declaration API is still experimental.
    'TypeScript Go is experimental. Some options will be unavailable.',
  ],
  deps: {
    onlyBundle: ['@types/geojson'],
  },
  publint: {
    enabled: 'ci-only',
    level: 'error',
  },
  attw: {
    enabled: 'ci-only',
    profile: 'esm-only',
    level: 'error',
  },
});
