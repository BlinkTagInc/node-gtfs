import {
  cancellationCheckpoint,
  downloadSignal,
  getOperationSignal,
  throwIfDownloadCancelled,
  throwIfOperationAborted,
} from '../cancellation.ts';
import type Database from 'better-sqlite3';
import { setTimeout as delay } from 'node:timers/promises';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { bufferBoundedResponse } from '../io/limits.ts';
import { fetchGtfsFeed } from '../io/download.ts';
import type { Kysely } from 'kysely';
import {
  beginReportingOperation,
  log,
  report,
  status,
  validationNotice,
} from '../reporting/report.ts';
import {
  formatCount,
  formatFileCount,
  redactUrlForReporting,
} from '../reporting/format.ts';
import {
  addImportError,
  addValidationNotice,
  createGtfsImportResult,
  createGtfsImportSourceResult,
  finishGtfsImportResult,
  type GtfsImportResult,
  type MutableGtfsImportResult,
} from '../schedule/import/result.ts';
import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
  GtfsValidationNoticeCode,
  toGtfsError,
} from '../diagnostics/errors.ts';

import {
  type ResolvedGtfsRealtimeFeedConfig,
  type ResolvedGtfsRealtimeRefreshConfig,
} from '../config/resolver.ts';
import type { GtfsReportingConfig } from '../reporting/types.ts';
import type { GtfsRealtimeWriter } from './writer.ts';
import { createSqliteGtfsRealtimeWriter } from '../database/sqlite/realtime-writer.ts';
import { createKyselyGtfsRealtimeWriter } from '../database/kysely/realtime-writer.ts';
import {
  applySqliteGtfsIndexPlan,
  applySqliteGtfsTablePlan,
} from '../database/sqlite/schema-writer.ts';
import {
  applyKyselyGtfsIndexPlan,
  applyKyselyGtfsTablePlan,
} from '../database/kysely/schema-writer.ts';
import { createGtfsStoragePlan } from '../database/storage/plan.ts';
import { assertCompatibleGtfsSchema } from '../database/schema-lifecycle.ts';
import {
  assertGtfsExtensionEnabled,
  resolveGtfsExtensions,
} from '../schema/extensions.ts';
import { createRealtimeSnapshotApplication } from './snapshot.ts';
import type { DecodedRealtimeFeed, FetchedRealtimeFeed } from './feed.ts';

interface RealtimeFeedRefreshTask {
  readonly scheduleRevision: string | null;
  readonly feed: ResolvedGtfsRealtimeFeedConfig;
  readonly currentEntitiesSeconds: number;
  readonly snapshotsSeconds: number | null;
  readonly sourceId: string;
  readonly nowUnixSeconds: number;
  readonly reporting: GtfsReportingConfig;
  readonly result: MutableGtfsImportResult;
  readonly delay: (milliseconds: number) => Promise<void>;
}

const MAX_DOWNLOAD_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

function isRetryableRealtimeDownloadError(error: GtfsError): boolean {
  if (error.code === GtfsErrorCode.DOWNLOAD_HTTP_FAILED) {
    return (
      error.statusCode !== undefined &&
      (error.statusCode === 408 ||
        error.statusCode === 425 ||
        error.statusCode === 429 ||
        error.statusCode >= 500)
    );
  }

  return error.code === GtfsErrorCode.DOWNLOAD_FAILED;
}

async function readRealtimeFeedResponse({
  response,
  feed,
  safeUrl,
}: {
  readonly response: Response;
  readonly feed: ResolvedGtfsRealtimeFeedConfig;
  readonly safeUrl: string;
}): Promise<FetchedRealtimeFeed> {
  if (!response.ok) {
    try {
      await response.body?.cancel();
    } catch {
      // Preserve the HTTP response as the actionable failure.
    }
    throw new GtfsError(
      `Could not download GTFS-Realtime feed ${JSON.stringify(feed.feedId)} from ${safeUrl}: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
      {
        code: GtfsErrorCode.DOWNLOAD_HTTP_FAILED,
        category: GtfsErrorCategory.DOWNLOAD,
        statusCode: response.status,
        details: {
          url: safeUrl,
          status: response.status,
          statusText: response.statusText,
        },
      },
    );
  }

  const rawPayload = await bufferBoundedResponse({
    response,
    maxBytes: feed.maxDownloadBytes,
    limit: 'maxDownloadBytes',
    details: { url: safeUrl, realtimeFeedId: feed.feedId },
  });
  await cancellationCheckpoint();
  let message: ReturnType<
    typeof GtfsRealtimeBindings.transit_realtime.FeedMessage.decode
  >;
  try {
    message =
      GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(rawPayload);
  } catch (error: unknown) {
    throw new GtfsError(
      `Invalid GTFS-Realtime protobuf from feed ${JSON.stringify(feed.feedId)}`,
      {
        code: GtfsErrorCode.REALTIME_PROTOBUF_INVALID,
        category: GtfsErrorCategory.PARSE,
        details: { realtimeFeedId: feed.feedId, url: safeUrl },
        cause: error,
      },
    );
  }

  const feedMessage =
    GtfsRealtimeBindings.transit_realtime.FeedMessage.toObject(message, {
      enums: String,
      longs: String,
      bytes: String,
      defaults: false,
      arrays: true,
      objects: true,
      oneofs: true,
    }) as DecodedRealtimeFeed;

  return {
    contentType: response.headers.get('content-type'),
    feed: feedMessage,
    rawPayload,
    httpHeaders: Object.fromEntries(response.headers.entries()),
    httpStatus: response.status,
  };
}

async function fetchGtfsRealtimeFeed(
  task: RealtimeFeedRefreshTask,
): Promise<FetchedRealtimeFeed> {
  const feed = task.feed;
  const safeUrl = redactUrlForReporting(feed.url);

  status(
    task.reporting,
    `Importing GTFS-Realtime feed ${JSON.stringify(feed.feedId)} from ${safeUrl}`,
    { phase: 'start' },
  );

  for (let attempt = 1; ; attempt++) {
    await cancellationCheckpoint();
    const { signal, dispose } = downloadSignal(feed.timeoutMs);
    try {
      const response = await fetchGtfsFeed({
        url: feed.url,
        requestHeaders: feed.requestHeaders,
        acceptEncoding: 'gzip',
        signal,
      });

      return await readRealtimeFeedResponse({ response, feed, safeUrl });
    } catch (error: unknown) {
      throwIfDownloadCancelled(signal);
      const timedOut =
        (signal.aborted &&
          signal.reason instanceof Error &&
          signal.reason.name === 'TimeoutError') ||
        (error instanceof Error && error.name === 'TimeoutError');
      const gtfsError = toGtfsError(error, {
        message: timedOut
          ? `GTFS-Realtime feed ${JSON.stringify(feed.feedId)} download timed out after ${feed.timeoutMs} ms; the \`sources[].realtime.feeds[].timeoutMs\` configuration option controls this timeout`
          : `Could not download GTFS-Realtime feed ${JSON.stringify(feed.feedId)} from ${safeUrl}`,
        code: GtfsErrorCode.DOWNLOAD_FAILED,
        category: GtfsErrorCategory.DOWNLOAD,
        details: {
          realtimeFeedId: feed.feedId,
          url: safeUrl,
          ...(timedOut ? { timeoutMs: feed.timeoutMs } : {}),
        },
      });
      if (
        attempt === MAX_DOWNLOAD_ATTEMPTS ||
        !isRetryableRealtimeDownloadError(gtfsError)
      ) {
        throw gtfsError;
      }

      log(
        task.reporting,
        'warn',
        `Feed ${JSON.stringify(feed.feedId)} attempt ${attempt} of ${MAX_DOWNLOAD_ATTEMPTS} failed; retrying: ${gtfsError.message}`,
      );
      dispose();
      await task.delay(RETRY_DELAY_MS * attempt);
    } finally {
      dispose();
    }
  }
}

async function applyFetchedRealtimeSnapshot(
  writer: GtfsRealtimeWriter,
  fetched: FetchedRealtimeFeed,
  task: RealtimeFeedRefreshTask,
): Promise<number> {
  await cancellationCheckpoint();
  const { validation, snapshot } = createRealtimeSnapshotApplication(fetched, {
    currentEntitiesSeconds: task.currentEntitiesSeconds,
    snapshotsSeconds: task.snapshotsSeconds,
    sourceId: task.sourceId,
    nowUnixSeconds: task.nowUnixSeconds,
    realtimeFeedId: task.feed.feedId,
    feedUrl: task.feed.url,
    onNotice(notice) {
      addValidationNotice(task.result, notice);
      validationNotice(task.reporting, notice, 'realtime');
    },
    ...(task.feed.type === undefined
      ? {}
      : { declaredFeedType: task.feed.type }),
  });
  const typeMismatch = validation.samples.find(
    (notice) =>
      notice.code === GtfsValidationNoticeCode.REALTIME_FEED_TYPE_MISMATCH,
  );
  if (typeMismatch !== undefined) {
    throw new GtfsError(typeMismatch.message, {
      code: GtfsErrorCode.REALTIME_FEED_TYPE_MISMATCH,
      category: GtfsErrorCategory.VALIDATION,
      details: {
        sourceId: task.sourceId,
        realtimeFeedId: task.feed.feedId,
        feedType: task.feed.type,
        url: redactUrlForReporting(task.feed.url),
        ...typeMismatch.details,
      },
    });
  }
  await cancellationCheckpoint();
  const result = await writer.applySnapshot(snapshot, task.scheduleRevision);
  let firstWriteError: GtfsError | undefined;

  for (const error of result.errors) {
    const writeError = toGtfsError(error, {
      message: `Could not store GTFS-Realtime snapshot ${JSON.stringify(snapshot.snapshotId)}`,
      code: GtfsErrorCode.DATABASE_OPERATION_FAILED,
      category: GtfsErrorCategory.DATABASE,
      details: {
        realtimeFeedId: task.feed.feedId,
        snapshotId: snapshot.snapshotId,
        sourceId: task.sourceId,
      },
    });
    if (writeError.code === GtfsErrorCode.OPERATION_CANCELLED) {
      throw writeError;
    }
    log(task.reporting, 'error', writeError, { sourceId: task.sourceId });
    firstWriteError ??= writeError;
    addImportError(task.result, writeError);
  }

  if (firstWriteError) {
    throw firstWriteError;
  }

  return result.recordCount;
}

async function refreshGtfsRealtimeFeed(
  task: RealtimeFeedRefreshTask,
  writer: GtfsRealtimeWriter,
): Promise<number> {
  const fetched = await fetchGtfsRealtimeFeed(task);

  const recordCount = await applyFetchedRealtimeSnapshot(writer, fetched, task);
  status(
    task.reporting,
    formatFileCount(`Realtime feed ${task.feed.feedId}`, recordCount),
    { phase: 'complete' },
  );
  return recordCount;
}

type GtfsRealtimeRefreshConnection<DB> =
  | {
      readonly database: Kysely<DB>;
      readonly sqlite?: never;
    }
  | {
      readonly database?: never;
      readonly sqlite: Database.Database;
    };

/** Runs a resolved Realtime refresh on an already-open connection. */
export async function refreshGtfsRealtimeOnConnection<DB>(options: {
  resolved: ResolvedGtfsRealtimeRefreshConfig<DB>;
  connection: GtfsRealtimeRefreshConnection<DB>;
  databaseDescription: string;
  delay?: (milliseconds: number) => Promise<void>;
}): Promise<GtfsImportResult> {
  const { resolved, connection, databaseDescription } = options;
  beginReportingOperation(resolved.reporting);
  const enabledExtensions = resolveGtfsExtensions(resolved.extensions);
  assertGtfsExtensionEnabled(
    'realtime_feeds',
    'gtfs-realtime',
    enabledExtensions,
  );
  const reporting = resolved.reporting;
  const databaseConfig = resolved.database;
  const startTime = process.hrtime.bigint();
  const realtimeResult = createGtfsImportResult();

  try {
    await cancellationCheckpoint();
    const storagePlan = createGtfsStoragePlan({
      dialect: databaseConfig.dialect,
      // DDL would commit a borrowed MySQL transaction before its savepoint.
      mode:
        connection.database?.isTransaction && databaseConfig.dialect === 'mysql'
          ? 'validate'
          : 'ensure',
      extensions: enabledExtensions,
    });
    let writer: GtfsRealtimeWriter;
    if (connection.database !== undefined) {
      await assertCompatibleGtfsSchema(
        await applyKyselyGtfsTablePlan(connection.database, storagePlan),
        { database: connection.database, dialect: databaseConfig.dialect },
      );
      await assertCompatibleGtfsSchema(
        await applyKyselyGtfsIndexPlan(connection.database, storagePlan),
        { database: connection.database, dialect: databaseConfig.dialect },
      );
      writer = createKyselyGtfsRealtimeWriter(connection.database, storagePlan);
    } else {
      await assertCompatibleGtfsSchema(
        applySqliteGtfsTablePlan(connection.sqlite, storagePlan),
        { database: connection.sqlite, dialect: 'sqlite' },
      );
      await assertCompatibleGtfsSchema(
        applySqliteGtfsIndexPlan(connection.sqlite, storagePlan),
        { database: connection.sqlite, dialect: 'sqlite' },
      );
      writer = createSqliteGtfsRealtimeWriter(connection.sqlite, storagePlan);
    }

    const sourceCount = resolved.sources.length;
    report(reporting, {
      type: 'operation:start',
      operation: 'realtime',
      sourceCount,
      sourceIds: resolved.sources.map((source) => source.sourceId),
      databaseDescription,
    });

    let feedCount = 0;
    let entityCount = 0;
    const scheduleRevisions = new Map<string, string | null>();
    for (const source of resolved.sources) {
      scheduleRevisions.set(
        source.sourceId,
        await writer.readScheduleRevision(source.sourceId),
      );
    }
    for (const source of resolved.sources) {
      const sourceStart = process.hrtime.bigint();
      const sourceResult = createGtfsImportSourceResult(source.sourceId);
      realtimeResult.sources.push(sourceResult);
      for (const feed of source.realtime.feeds) {
        await cancellationCheckpoint();
        feedCount += 1;
        entityCount += await refreshGtfsRealtimeFeed(
          {
            feed,
            scheduleRevision: scheduleRevisions.get(source.sourceId) ?? null,
            currentEntitiesSeconds:
              resolved.realtime.retention.currentEntitiesSeconds,
            snapshotsSeconds: resolved.realtime.retention.snapshotsSeconds,
            sourceId: source.sourceId,
            nowUnixSeconds: Math.floor(Date.now() / 1000),
            reporting,
            result: realtimeResult,
            delay:
              options.delay ??
              (async (milliseconds) => {
                try {
                  await delay(milliseconds, undefined, {
                    signal: getOperationSignal(),
                  });
                } catch (error) {
                  throwIfOperationAborted();
                  throw error;
                }
              }),
          },
          writer,
        );
      }
      sourceResult.success = true;
      sourceResult.durationMs =
        Number(process.hrtime.bigint() - sourceStart) / 1_000_000;
    }

    report(reporting, {
      type: 'operation:complete',
      operation: 'realtime',
      durationMs: Number((process.hrtime.bigint() - startTime) / 1_000_000n),
      summary: `${formatCount(entityCount)} entities from ${formatCount(feedCount)} feeds`,
    });
    return finishGtfsImportResult(
      realtimeResult,
      Number(process.hrtime.bigint() - startTime) / 1_000_000,
    );
  } catch (error: unknown) {
    throw toGtfsError(error, {
      message: 'Could not refresh GTFS-Realtime data',
      code: GtfsErrorCode.DATABASE_OPERATION_FAILED,
      category: GtfsErrorCategory.DATABASE,
    });
  }
}
