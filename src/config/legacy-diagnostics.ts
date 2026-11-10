import { formatConfigPath, type GtfsConfigIssue } from './validation.ts';
import { isPlainObject } from './options.ts';
import {
  GTFS_LEGACY_CONFIG_PATHS,
  type GtfsLegacyConfigPath,
} from './legacy-paths.ts';

const legacyPathByPattern = new Map(
  GTFS_LEGACY_CONFIG_PATHS.map((entry) => [entry.pattern, entry]),
);

function normalizeLegacyConfigPath(path: string): string {
  return path.replaceAll(/\[\d+\]/g, '[]');
}

function formatLegacyConfigMessage(
  actualPath: string,
  definition: GtfsLegacyConfigPath,
): string {
  const action =
    definition.replacementPath === null
      ? 'has been removed without replacement'
      : `was removed; use configuration option \`${definition.replacementPath}\``;
  return `Configuration option \`${actualPath}\` ${action}${definition.explanation ? ` ${definition.explanation}` : ''}`;
}

export function isLegacyConfigPath(path: string): boolean {
  return legacyPathByPattern.has(normalizeLegacyConfigPath(path));
}

export function collectLegacyConfigIssues(
  value: unknown,
  path: string,
  issues: GtfsConfigIssue[],
): void {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = Array.isArray(value)
      ? `${path}[${key}]`
      : formatConfigPath(path, key);
    const definition = legacyPathByPattern.get(
      normalizeLegacyConfigPath(childPath),
    );
    if (definition) {
      issues.push({
        reason: 'legacy-option',
        path: childPath,
        legacyPath: childPath,
        replacementPath: definition.replacementPath,
        message: formatLegacyConfigMessage(childPath, definition),
      });
    }
    collectLegacyConfigIssues(child, childPath, issues);
  }
}
