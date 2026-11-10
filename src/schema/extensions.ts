import {
  addConfigIssue,
  type ConfigValidationContext,
  type GtfsConfigIssue,
} from '../config/validation.ts';
import { DEFAULT_GTFS_EXTENSIONS } from '../config/defaults.ts';
import {
  gtfsExtensions,
  type GtfsExtension,
  type GtfsSpecification,
} from './define-table.ts';
import {
  createGtfsConfigError,
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../diagnostics/errors.ts';

export const GTFS_SCHEDULE_CORE = 'gtfs-schedule' as const;

export type { GtfsExtension } from './define-table.ts';

/** Caller input for selecting optional GTFS extensions. */
export type GtfsExtensionSelection = readonly GtfsExtension[];

/** Shared extension option used by instances and database operations. */
export interface GtfsExtensionOptions {
  /** Defaults to no extensions; GTFS Schedule is always enabled. */
  readonly extensions?: GtfsExtensionSelection;
}

/** Import-only selection that derives one extension union from every source. */
export type GtfsImportExtensionSelection = GtfsExtensionSelection | 'auto';

/** Defaults to no extensions; `auto` scans every source before schema setup. */
export type GtfsImportExtensionOptions =
  GtfsExtensionOptions | { readonly extensions: 'auto' };

export { DEFAULT_GTFS_EXTENSIONS } from '../config/defaults.ts';

/** Validates a selection while retaining all issues for configuration callers. */
export function resolveGtfsExtensionSelection(
  value: unknown,
  context: Pick<ConfigValidationContext, 'issues'>,
): readonly GtfsExtension[] {
  if (value === undefined) {
    return DEFAULT_GTFS_EXTENSIONS;
  }
  if (!Array.isArray(value)) {
    addConfigIssue(
      context,
      'invalid-value',
      'extensions',
      'Configuration option `extensions` must be an array of registered GTFS extensions',
    );
    return DEFAULT_GTFS_EXTENSIONS;
  }
  const selected = new Set<GtfsExtension>();
  for (const [index, extension] of value.entries()) {
    const path = `extensions[${index}]`;
    if (extension === 'gtfs-schedule') {
      addConfigIssue(
        context,
        'invalid-value',
        path,
        `Configuration option \`${path}\` must omit \`gtfs-schedule\`, which is core and always enabled`,
      );
      continue;
    }
    if (
      typeof extension !== 'string' ||
      !gtfsExtensions.includes(extension as GtfsExtension)
    ) {
      addConfigIssue(
        context,
        'invalid-value',
        path,
        `Configuration option \`${path}\` must be one of ${gtfsExtensions.map((item) => JSON.stringify(item)).join(', ')}`,
      );
      continue;
    }
    if (selected.has(extension as GtfsExtension)) {
      addConfigIssue(
        context,
        'duplicate-value',
        path,
        `Duplicate GTFS extension ${JSON.stringify(extension)} at configuration option \`${path}\``,
      );
      continue;
    }
    selected.add(extension as GtfsExtension);
  }
  if (selected.has('tods') && selected.has('tods-v1')) {
    addConfigIssue(
      context,
      'invalid-combination',
      'extensions',
      'GTFS extensions `tods` and `tods-v1` cannot be enabled together in the `extensions` configuration array; choose one TODS version for the database',
    );
  }
  return Object.freeze(
    gtfsExtensions.filter((extension) => selected.has(extension)),
  );
}

/** Resolves caller input to canonical manifest order without retaining it. */
export function resolveGtfsExtensions(
  selection: GtfsExtensionSelection | undefined,
): readonly GtfsExtension[] {
  const issues: GtfsConfigIssue[] = [];
  const extensions = resolveGtfsExtensionSelection(selection, { issues });
  const first = issues[0];
  if (first !== undefined) {
    throw createGtfsConfigError(first.message, {
      path: first.path,
      reason: first.reason,
    });
  }
  return extensions;
}
export function filterGtfsTablesByExtensions<
  Table extends { readonly specification: GtfsSpecification },
>(tables: readonly Table[], extensions: readonly GtfsExtension[]): Table[] {
  const enabled = new Set<GtfsSpecification>([
    GTFS_SCHEDULE_CORE,
    ...extensions,
  ]);
  return tables.filter((table) => enabled.has(table.specification));
}

export function assertGtfsExtensionEnabled(
  table: string,
  specification: GtfsSpecification,
  enabledExtensions: readonly GtfsExtension[],
): void {
  if (
    specification === GTFS_SCHEDULE_CORE ||
    enabledExtensions.includes(specification as GtfsExtension)
  ) {
    return;
  }
  throw new GtfsError(
    `GTFS extension ${JSON.stringify(specification)} is disabled for table ${JSON.stringify(table)}; add ${JSON.stringify(specification)} to the \`extensions\` array in configuration to enable it`,
    {
      code: GtfsErrorCode.EXTENSION_DISABLED,
      category: GtfsErrorCategory.QUERY,
      details: {
        table,
        extension: specification,
        enabledExtensions: [...enabledExtensions],
      },
    },
  );
}
