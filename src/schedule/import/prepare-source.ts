import {
  cancellationCheckpoint,
  downloadSignal,
  throwIfDownloadCancelled,
  throwIfOperationAborted,
} from '../../cancellation.ts';
import path from 'node:path';
import { createWriteStream, existsSync, lstatSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { cp, readdir, rename, rm, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileBackedTables } from '../../schema/table-registry.ts';
import type {
  ResolvedGtfsImportConfig,
  ResolvedGtfsScheduleSourceConfig,
} from '../../config/resolver.ts';
import { expandHomeDirectory } from '../../io/paths.ts';
import { extractZipArchive } from '../../io/zip.ts';
import { readBoundedResponse } from '../../io/limits.ts';
import { fetchGtfsFeed } from '../../io/download.ts';
import {
  GtfsError,
  GtfsErrorCode,
  GtfsErrorCategory,
  toGtfsError,
} from '../../diagnostics/errors.ts';
import { log, progress, status } from '../../reporting/report.ts';
import { formatBytes, redactUrlForReporting } from '../../reporting/format.ts';
import type { GtfsReportingConfig } from '../../reporting/types.ts';
import {
  resolveGtfsExtensions,
  type GtfsExtension,
} from '../../schema/extensions.ts';

export type ScheduleImportSource = ResolvedGtfsImportConfig['sources'][number];

export interface PreparedScheduleSource {
  readonly source: ScheduleImportSource;
  readonly stagingDirectory: string;
  cleanup(): Promise<void>;
}

async function listGtfsFiles(folderPath: string): Promise<string[]> {
  const filenames = new Set(fileBackedTables.map((table) => table.filename));
  const entries = await readdir(folderPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && filenames.has(entry.name))
    .map((entry) => entry.name);
}

async function downloadGtfsArchive(options: {
  source: ResolvedGtfsScheduleSourceConfig;
  stagingDirectory: string;
  reporting: GtfsReportingConfig;
  databaseDescription?: string;
}): Promise<string> {
  const { source, stagingDirectory, reporting } = options;
  if (!('url' in source)) {
    throw new GtfsError(
      'Missing required configuration option `sources[].schedule.url` in config.json (or your JavaScript configuration)',
      {
        code: GtfsErrorCode.CONFIG_INVALID,
        category: GtfsErrorCategory.CONFIG,
      },
    );
  }

  status(
    reporting,
    `Downloading GTFS from ${redactUrlForReporting(source.url)}`,
    {
      phase: 'start',
      ...(options.databaseDescription === undefined
        ? {}
        : { databaseDescription: options.databaseDescription }),
    },
  );

  const downloadStart = process.hrtime.bigint();
  const filePath = path.join(stagingDirectory, 'gtfs.zip');
  const safeUrl = redactUrlForReporting(source.url);

  const { signal, dispose } = downloadSignal(source.timeoutMs);
  try {
    const response = await fetchGtfsFeed({
      url: source.url,
      requestHeaders: source.requestHeaders,
      signal,
    });

    if (!response.ok) {
      await response.body?.cancel();
      throw new GtfsError(
        `Could not download GTFS Schedule from ${safeUrl}: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
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

    const declaredLength = Number(response.headers.get('content-length'));
    // Fetch decodes encoded bodies, so their wire length is not a byte total.
    const total =
      !response.headers.get('content-encoding') &&
      Number.isSafeInteger(declaredLength) &&
      declaredLength > 0
        ? declaredLength
        : undefined;
    async function* downloadChunks(): AsyncGenerator<Uint8Array> {
      let current = 0;
      let lastReport = 0;
      for await (const chunk of readBoundedResponse({
        response,
        maxBytes: source.import.archive.maxCompressedBytes,
        limit: 'maxCompressedBytes',
        details: { url: safeUrl },
      })) {
        current += chunk.byteLength;
        const now = Date.now();
        if (now - lastReport >= 100 || current === total) {
          progress(
            reporting,
            `Downloading ${formatBytes(current)}${total === undefined ? '' : ` / ${formatBytes(total)}`}`,
            { current, ...(total === undefined ? {} : { total }) },
          );
          lastReport = now;
        }
        yield chunk;
      }
    }
    await pipeline(
      Readable.from(downloadChunks()),
      createWriteStream(filePath, { flags: 'wx' }),
    );
    const { size } = await stat(filePath);
    status(
      reporting,
      `Downloaded ${formatBytes(size)} in ${(Number(process.hrtime.bigint() - downloadStart) / 1_000_000_000).toFixed(1)} seconds`,
      { phase: 'complete' },
    );
    return filePath;
  } catch (error: unknown) {
    throwIfDownloadCancelled(signal);
    throw toGtfsError(error, {
      message:
        error instanceof Error && error.name === 'TimeoutError'
          ? `GTFS Schedule download from ${safeUrl} timed out after ${source.timeoutMs} ms; the \`sources[].schedule.timeoutMs\` configuration option controls this timeout`
          : `Could not download GTFS Schedule from ${safeUrl}`,
      code: GtfsErrorCode.DOWNLOAD_FAILED,
      category: GtfsErrorCategory.DOWNLOAD,
      details: { url: safeUrl, timeoutMs: source.timeoutMs },
    });
  } finally {
    dispose();
  }
}

async function stageGtfsFiles(options: {
  source: ResolvedGtfsScheduleSourceConfig;
  sourcePath: string | undefined;
  stagingDirectory: string;
  reporting: GtfsReportingConfig;
  databaseDescription?: string;
}): Promise<void> {
  const { source, sourcePath, stagingDirectory, reporting } = options;
  if (!sourcePath) {
    throw new GtfsError(
      'Missing required configuration option `sources[].schedule.path` in config.json (or your JavaScript configuration)',
      {
        code: GtfsErrorCode.CONFIG_INVALID,
        category: GtfsErrorCategory.CONFIG,
        details: { field: 'path' },
      },
    );
  }

  const gtfsPath = expandHomeDirectory(sourcePath);
  if (!('url' in source)) {
    status(reporting, `Importing static GTFS from ${sourcePath}`, {
      phase: 'start',
      ...(options.databaseDescription === undefined
        ? {}
        : { databaseDescription: options.databaseDescription }),
    });
  }
  if (path.extname(gtfsPath) === '.zip') {
    try {
      await extractZipArchive(
        gtfsPath,
        stagingDirectory,
        source.import.archive,
      );
      const feedFiles = await listGtfsFiles(stagingDirectory);

      if (feedFiles.length === 0) {
        const files = await readdir(stagingDirectory);
        const folders = files
          .filter((filename) => !['__MACOSX'].includes(filename))
          .map((filename) => path.join(stagingDirectory, filename))
          .filter((source) => lstatSync(source).isDirectory());

        const subfolderName = folders.at(0);
        if (folders.length > 1) {
          throw new GtfsError(
            `Invalid GTFS ZIP ${JSON.stringify(sourcePath)}: found more than one feed directory; place GTFS files at the ZIP root or in one directory`,
            {
              code: GtfsErrorCode.ZIP_INVALID,
              category: GtfsErrorCategory.ZIP,
              details: { sourcePath, folderCount: folders.length },
            },
          );
        } else if (subfolderName === undefined) {
          throw new GtfsError(
            `Invalid GTFS ZIP ${JSON.stringify(sourcePath)}: no GTFS files found; place GTFS files at the ZIP root or in one directory`,
            {
              code: GtfsErrorCode.ZIP_INVALID,
              category: GtfsErrorCategory.ZIP,
              details: { sourcePath },
            },
          );
        }

        const directoryFeedFiles = await listGtfsFiles(subfolderName);

        if (directoryFeedFiles.length === 0) {
          throw new GtfsError(
            `Invalid GTFS ZIP ${JSON.stringify(sourcePath)}: no GTFS files found; place GTFS files at the ZIP root or in one directory`,
            {
              code: GtfsErrorCode.ZIP_INVALID,
              category: GtfsErrorCategory.ZIP,
              details: { sourcePath, subfolderName },
            },
          );
        }

        await Promise.all(
          directoryFeedFiles.map(async (fileName) =>
            rename(
              path.join(subfolderName, fileName),
              path.join(stagingDirectory, fileName),
            ),
          ),
        );
      }
    } catch (error: unknown) {
      const wrappedError = toGtfsError(error, {
        message: `Could not extract GTFS ZIP ${JSON.stringify(sourcePath)}`,
        code: GtfsErrorCode.ZIP_INVALID,
        category: GtfsErrorCategory.ZIP,
        details: { sourcePath },
      });
      if (wrappedError.code !== GtfsErrorCode.OPERATION_CANCELLED) {
        log(reporting, 'error', wrappedError);
      }
      throw wrappedError;
    }
  } else {
    try {
      await cp(gtfsPath, stagingDirectory, {
        recursive: true,
        filter: async () => {
          await cancellationCheckpoint();
          return true;
        },
      });
    } catch (error: unknown) {
      throwIfOperationAborted();
      throw new GtfsError(
        `Could not read GTFS source directory ${JSON.stringify(gtfsPath)}; verify that it exists and contains GTFS files`,
        {
          code: GtfsErrorCode.SOURCE_READ_FAILED,
          category: GtfsErrorCategory.SOURCE,
          details: { sourcePath: gtfsPath },
          cause: error,
        },
      );
    }
  }
}

export async function prepareScheduleSource(options: {
  readonly source: ScheduleImportSource;
  readonly reporting: GtfsReportingConfig;
  readonly databaseDescription?: string;
}): Promise<PreparedScheduleSource> {
  const { source, reporting } = options;
  const databaseContext =
    options.databaseDescription === undefined
      ? {}
      : { databaseDescription: options.databaseDescription };
  throwIfOperationAborted();
  const stagingDirectory = mkdtempSync(path.join(tmpdir(), 'gtfs-'));
  const cleanup = () => rm(stagingDirectory, { recursive: true, force: true });

  try {
    await cancellationCheckpoint();
    const schedule = source.schedule;
    const sourcePath =
      'url' in schedule
        ? await downloadGtfsArchive({
            ...databaseContext,
            source: schedule,
            stagingDirectory,
            reporting,
          })
        : schedule.path;
    await stageGtfsFiles({
      ...databaseContext,
      source: schedule,
      sourcePath,
      stagingDirectory,
      reporting,
    });
    await cancellationCheckpoint();
    return Object.freeze({ source, stagingDirectory, cleanup });
  } catch (error) {
    await cleanup();
    throw error;
  }
}

export function detectScheduleSourceExtensions(
  preparedSources: readonly PreparedScheduleSource[],
): readonly GtfsExtension[] {
  const detected = new Set<GtfsExtension>();
  for (const { source, stagingDirectory } of preparedSources) {
    for (const table of fileBackedTables) {
      if (
        table.specification !== 'gtfs-schedule' &&
        table.specification !== 'tods-v1' &&
        !source.schedule.excludeFiles.includes(table.filename) &&
        existsSync(path.join(stagingDirectory, table.filename))
      ) {
        detected.add(table.specification);
      }
    }
  }
  return resolveGtfsExtensions([...detected]);
}
