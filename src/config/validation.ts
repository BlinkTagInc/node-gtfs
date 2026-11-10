import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../diagnostics/errors.ts';

export interface GtfsConfigIssue {
  readonly reason:
    | 'duplicate-value'
    | 'invalid-combination'
    | 'invalid-type'
    | 'invalid-value'
    | 'legacy-option'
    | 'missing-value'
    | 'unknown-option';
  readonly path: string;
  readonly message: string;
  readonly legacyPath?: string;
  readonly replacementPath?: string | null;
  readonly suggestion?: string;
}

export interface ConfigValidationContext {
  readonly format: 'javascript' | 'json';
  issues: GtfsConfigIssue[];
  readonly operation: 'export' | 'import' | 'instance' | 'realtime';
}

export function formatConfigPath(parent: string, key: string): string {
  return parent === '' ? key : `${parent}.${key}`;
}

export function addConfigIssue(
  context: Pick<ConfigValidationContext, 'issues'>,
  reason: GtfsConfigIssue['reason'],
  path: string,
  message: string,
): void {
  context.issues.push({ reason, path, message });
}

export function throwConfigIssues(issues: readonly GtfsConfigIssue[]): never {
  const firstLegacy = issues.find((item) => item.reason === 'legacy-option');
  throw new GtfsError(
    `Invalid configuration:\n${issues.map((item) => `  - ${item.message}`).join('\n')}\nCheck your configuration file (config.json by default) or JavaScript configuration object.`,
    {
      code: GtfsErrorCode.CONFIG_INVALID,
      category: GtfsErrorCategory.CONFIG,
      details: {
        reason:
          issues.length === 1
            ? (issues.at(0)?.reason ?? 'multiple-config-errors')
            : 'multiple-config-errors',
        ...(firstLegacy
          ? {
              legacyPath: firstLegacy.legacyPath,
              replacementPath: firstLegacy.replacementPath,
            }
          : {}),
        errors: issues.map((item) => ({ ...item })),
      },
    },
  );
}
