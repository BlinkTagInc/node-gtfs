import type { GtfsExtension } from '../../src/schema/define-table.ts';

/** Explicit schema used by broad conformance fixtures and their DDL snapshot. */
export const fixtureExtensions = Object.freeze([
  'gtfs-realtime',
  'gtfs-plus',
  'gtfs-ride',
  'gtfs-to-html',
  'tods',
  'tides',
] as const satisfies readonly GtfsExtension[]);
