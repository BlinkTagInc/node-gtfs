import {
  addConfigIssue,
  type ConfigValidationContext as ValidationContext,
} from './validation.ts';
import type {
  ResolvedGtfsSourceConfig,
  ResolvedGtfsRealtimeFeedConfig,
  ResolvedGtfsConfig,
} from './resolved.ts';
import {
  readConfigObject,
  validateKnownConfigKeys,
  readConfigString,
  readConfigEnum,
  readConfigNumber,
} from './readers.ts';
import { resolveDownloadOptions } from './download.ts';
import { isNonNegativeNumber } from './options.ts';
import {
  DEFAULT_GTFS_REALTIME_FEED_CONFIG,
  DEFAULT_GTFS_REALTIME_RETENTION_CONFIG,
} from './defaults.ts';
const KNOWN_KEYS = {
  realtimeSource: ['feeds'],
  realtimeFeed: [
    'type',
    'feedId',
    'url',
    'requestHeaders',
    'timeoutMs',
    'maxDownloadBytes',
  ],
  realtime: ['retention'],
  retention: ['currentEntitiesSeconds', 'snapshotsSeconds'],
} as const;

export function resolveSourceRealtimeFeeds(
  value: unknown,
  path: string,
  context: ValidationContext,
): ResolvedGtfsSourceConfig['realtime'] | undefined {
  const realtime = readConfigObject(value, path, context);
  if (!realtime) {
    return undefined;
  }
  validateKnownConfigKeys(realtime, path, KNOWN_KEYS.realtimeSource, context);
  if (!Array.isArray(realtime.feeds) || realtime.feeds.length === 0) {
    addConfigIssue(
      context,
      'invalid-type',
      `${path}.feeds`,
      `Configuration option \`${path}.feeds\` must be a non-empty array`,
    );
    return Object.freeze({ feeds: Object.freeze([]) });
  }
  const feeds: ResolvedGtfsRealtimeFeedConfig[] = [];
  const feedIds = new Set<string>();
  for (const [index, feedValue] of realtime.feeds.entries()) {
    const feedPath = `${path}.feeds[${index}]`;
    const feed = readConfigObject(feedValue, feedPath, context, true);
    if (!feed) {
      continue;
    }
    validateKnownConfigKeys(feed, feedPath, KNOWN_KEYS.realtimeFeed, context);
    const type =
      feed.type === undefined
        ? undefined
        : readConfigEnum(
            feed.type,
            `${feedPath}.type`,
            context,
            [
              'alerts',
              'tripUpdates',
              'vehiclePositions',
              'shapes',
              'stops',
              'tripModifications',
              'mixed',
            ] as const,
            'mixed',
          );
    const feedId = readConfigString(
      feed.feedId,
      `${feedPath}.feedId`,
      context,
      feed.feedId !== undefined,
    );
    if (feedId === undefined && type === undefined) {
      addConfigIssue(
        context,
        'missing-value',
        feedPath,
        `Each Realtime feed configuration object at \`${feedPath}\` requires \`type\` or \`feedId\``,
      );
    }
    const resolvedFeedId = feedId ?? type ?? '';
    if (resolvedFeedId && feedIds.has(resolvedFeedId)) {
      const identifierPath =
        feedId === undefined ? `${feedPath}.type` : `${feedPath}.feedId`;
      addConfigIssue(
        context,
        'duplicate-value',
        identifierPath,
        `Duplicate resolved Realtime feed ID ${JSON.stringify(resolvedFeedId)} at configuration option \`${identifierPath}\` within \`${path}\`; set a unique \`${feedPath}.feedId\` configuration option for each feed of the same type`,
      );
    }
    if (resolvedFeedId) {
      feedIds.add(resolvedFeedId);
    }
    const url = readConfigString(feed.url, `${feedPath}.url`, context, true);
    feeds.push(
      Object.freeze({
        feedId: resolvedFeedId,
        ...(type === undefined ? {} : { type }),
        url: url ?? '',
        ...resolveDownloadOptions({
          value: feed,
          path: feedPath,
          context,
          defaults: DEFAULT_GTFS_REALTIME_FEED_CONFIG,
        }),
        maxDownloadBytes: readConfigNumber(
          feed.maxDownloadBytes,
          `${feedPath}.maxDownloadBytes`,
          context,
          DEFAULT_GTFS_REALTIME_FEED_CONFIG.maxDownloadBytes,
          { integer: true, range: 'positive' },
        ),
      }),
    );
  }
  return Object.freeze({ feeds: Object.freeze(feeds) });
}

export function resolveRealtimeRetention(
  value: unknown,
  context: ValidationContext,
): ResolvedGtfsConfig['realtime'] {
  const realtime = readConfigObject(value, 'realtime', context) ?? {};
  validateKnownConfigKeys(realtime, 'realtime', KNOWN_KEYS.realtime, context);
  const retention =
    readConfigObject(realtime.retention, 'realtime.retention', context) ?? {};
  validateKnownConfigKeys(
    retention,
    'realtime.retention',
    KNOWN_KEYS.retention,
    context,
  );
  const snapshots = retention.snapshotsSeconds;
  const snapshotsValid =
    snapshots === undefined ||
    snapshots === null ||
    isNonNegativeNumber(snapshots, { integer: true });
  if (!snapshotsValid) {
    addConfigIssue(
      context,
      'invalid-value',
      'realtime.retention.snapshotsSeconds',
      'Configuration option `realtime.retention.snapshotsSeconds` must be a non-negative safe integer or null',
    );
  }
  return Object.freeze({
    retention: Object.freeze({
      currentEntitiesSeconds: readConfigNumber(
        retention.currentEntitiesSeconds,
        'realtime.retention.currentEntitiesSeconds',
        context,
        DEFAULT_GTFS_REALTIME_RETENTION_CONFIG.currentEntitiesSeconds,
        { integer: true, range: 'non-negative' },
      ),
      snapshotsSeconds:
        snapshots === undefined || !snapshotsValid
          ? DEFAULT_GTFS_REALTIME_RETENTION_CONFIG.snapshotsSeconds
          : snapshots,
    }),
  });
}
