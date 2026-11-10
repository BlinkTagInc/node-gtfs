import {
  addConfigIssue,
  type ConfigValidationContext as ValidationContext,
} from './validation.ts';
import type { ResolvedGtfsSourceConfig } from './resolved.ts';
import {
  readConfigObject,
  validateKnownConfigKeys,
  readConfigString,
} from './readers.ts';
import { resolveScheduleSource } from './schedule.ts';
import { resolveSourceRealtimeFeeds } from './realtime.ts';

import { DEFAULT_GTFS_SOURCE_ID } from './defaults.ts';

export function resolveSources(
  value: unknown,
  context: ValidationContext,
): readonly ResolvedGtfsSourceConfig[] {
  if (!Array.isArray(value) || value.length === 0) {
    if (context.operation === 'import' || context.operation === 'realtime') {
      addConfigIssue(
        context,
        'invalid-type',
        'sources',
        'Configuration option `sources` must be a non-empty array',
      );
    }
    return Object.freeze([]);
  }
  const sources: ResolvedGtfsSourceConfig[] = [];
  const sourceIds = new Set<string>();
  const requiresExplicitSourceIds = value.length > 1;
  for (const [index, sourceValue] of value.entries()) {
    const path = `sources[${index}]`;
    const source = readConfigObject(sourceValue, path, context, true);
    if (!source) {
      continue;
    }
    validateKnownConfigKeys(
      source,
      path,
      ['sourceId', 'schedule', 'realtime'],
      context,
    );
    if (requiresExplicitSourceIds && source.sourceId === undefined) {
      addConfigIssue(
        context,
        'missing-value',
        `${path}.sourceId`,
        `Configuration option \`${path}.sourceId\` is required when configuring multiple sources`,
      );
    }
    const sourceId = readConfigString(
      source.sourceId,
      `${path}.sourceId`,
      context,
      source.sourceId !== undefined,
    );
    if (sourceId && sourceIds.has(sourceId)) {
      addConfigIssue(
        context,
        'duplicate-value',
        `${path}.sourceId`,
        `Duplicate source ID ${JSON.stringify(sourceId)} at configuration option \`${path}.sourceId\``,
      );
    }
    if (sourceId) {
      sourceIds.add(sourceId);
    }
    const schedule = resolveScheduleSource(
      source.schedule,
      `${path}.schedule`,
      context,
    );
    const realtime = resolveSourceRealtimeFeeds(
      source.realtime,
      `${path}.realtime`,
      context,
    );
    if (!schedule && !realtime && context.operation !== 'instance') {
      addConfigIssue(
        context,
        'missing-value',
        path,
        `Configuration option \`${path}\` must define \`schedule\`, \`realtime\`, or both`,
      );
    }
    if (context.operation === 'import' && !schedule) {
      addConfigIssue(
        context,
        'missing-value',
        `${path}.schedule`,
        `Configuration option \`${path}.schedule\` is required by Schedule import`,
      );
    }
    if (context.operation === 'realtime' && !realtime) {
      addConfigIssue(
        context,
        'missing-value',
        `${path}.realtime`,
        `Configuration option \`${path}.realtime\` is required by Realtime refresh`,
      );
    }
    sources.push(
      Object.freeze({
        sourceId: sourceId ?? DEFAULT_GTFS_SOURCE_ID,
        ...(schedule ? { schedule } : {}),
        ...(realtime ? { realtime } : {}),
      }),
    );
  }
  return Object.freeze(sources);
}
