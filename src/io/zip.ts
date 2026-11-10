import {
  cancellationCheckpoint,
  throwIfOperationAborted,
} from '../cancellation.ts';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { crc32, createInflateRaw } from 'node:zlib';
import { open, type Entry, type ZipFile } from 'yauzl';

import { isGtfsError } from '../diagnostics/errors.ts';
import { assertInputLimit, type ArchiveLimits } from './limits.ts';
import { DEFAULT_ARCHIVE_LIMITS } from '../config/defaults.ts';

async function readArchiveEntries(
  zip: ZipFile,
  archivePath: string,
  limits: ArchiveLimits,
): Promise<readonly Entry[]> {
  const entries: Entry[] = [];
  let totalBytes = 0;
  const check = (
    limit: keyof ArchiveLimits,
    value: number,
    entryName?: string,
  ) =>
    assertInputLimit({
      value,
      maximum: limits[limit],
      limit,
      kind: 'zip',
      details: {
        sourcePath: archivePath,
        ...(entryName === undefined ? {} : { entryName }),
      },
    });
  check('maxEntries', zip.entryCount);
  await new Promise<void>((resolve, reject) => {
    zip.on('error', reject);
    zip.on('end', resolve);
    zip.on('entry', (entry: Entry) => {
      try {
        throwIfOperationAborted();
        check('maxEntries', entries.length + 1);
        check('maxExtractedFileBytes', entry.uncompressedSize, entry.fileName);
        totalBytes += entry.uncompressedSize;
        check('maxExtractedTotalBytes', totalBytes, entry.fileName);
        if (!entry.canDecodeFileData()) {
          throw new Error(
            `Unsupported compression or encryption in ZIP entry ${JSON.stringify(entry.fileName)}`,
          );
        }
        entries.push(entry);
        zip.readEntry();
      } catch (error) {
        reject(error);
      }
    });
    zip.readEntry();
  });
  return entries;
}

export async function extractZipArchive(
  archivePath: string,
  destinationDirectory: string,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): Promise<void> {
  let zip: ZipFile | undefined;
  let extractionError: unknown;
  try {
    assertInputLimit({
      value: (await stat(archivePath)).size,
      maximum: limits.maxCompressedBytes,
      limit: 'maxCompressedBytes',
      kind: 'zip',
      details: { sourcePath: archivePath },
    });
    zip = await new Promise<ZipFile>((resolve, reject) => {
      open(
        archivePath,
        {
          lazyEntries: true,
          autoClose: false,
          strictFileNames: true,
          validateEntrySizes: true,
        },
        (error, archive) => {
          if (error) {
            reject(error);
          } else {
            resolve(archive);
          }
        },
      );
    });
    // Validate all names and declared budgets before creating any output.
    // Entry count is bounded before collecting the central-directory metadata.
    const entries = await readArchiveEntries(zip, archivePath, limits);
    const root = path.resolve(destinationDirectory);
    let totalBytes = 0;
    for (const entry of entries) {
      await cancellationCheckpoint();
      const outputPath = path.resolve(root, entry.fileName);
      const relativePath = path.relative(root, outputPath);
      if (
        !relativePath ||
        relativePath === '..' ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
      ) {
        throw new Error(
          `Invalid ZIP entry path ${JSON.stringify(entry.fileName)}`,
        );
      }
      if (entry.fileName.endsWith('/')) {
        await mkdir(outputPath, { recursive: true });
        continue;
      }
      await mkdir(path.dirname(outputPath), { recursive: true });
      const archive = zip;
      const input = await new Promise<Readable>((resolve, reject) => {
        archive.openReadStream(
          entry,
          { decodeFileData: false },
          (error, stream) => {
            if (error) {
              reject(error);
            } else {
              resolve(stream);
            }
          },
        );
      });
      let entryBytes = 0;
      let checksum = 0;
      const budget = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          try {
            throwIfOperationAborted();
            entryBytes += chunk.byteLength;
            totalBytes += chunk.byteLength;
            for (const [limit, value] of [
              ['maxExtractedFileBytes', entryBytes],
              ['maxExtractedTotalBytes', totalBytes],
            ] as const) {
              assertInputLimit({
                value,
                maximum: limits[limit],
                limit,
                kind: 'zip',
                details: { sourcePath: archivePath, entryName: entry.fileName },
              });
            }
            if (entryBytes > entry.uncompressedSize) {
              throw new Error(
                `Invalid uncompressed size for ZIP entry ${JSON.stringify(entry.fileName)}`,
              );
            }
            checksum = crc32(chunk, checksum);
            callback(null, chunk);
          } catch (error) {
            callback(error as Error);
          }
        },
        flush(callback) {
          if (
            entryBytes !== entry.uncompressedSize ||
            checksum !== entry.crc32
          ) {
            callback(
              new Error(
                `Invalid size or checksum for ZIP entry ${JSON.stringify(entry.fileName)}`,
              ),
            );
          } else {
            callback();
          }
        },
      });
      // Own the entire stream chain so rejection also destroys the inflater.
      await pipeline([
        input,
        ...(entry.compressionMethod === 8 ? [createInflateRaw()] : []),
        budget,
        createWriteStream(outputPath, { flags: 'wx' }),
      ]);
    }
  } catch (error) {
    extractionError = error;
  } finally {
    if (zip !== undefined && zip.isOpen) {
      const archive = zip;
      try {
        await new Promise<void>((resolve, reject) => {
          archive.once('close', resolve);
          archive.once('error', reject);
          archive.close();
        });
      } catch (error) {
        extractionError ??= error;
      }
    }
  }
  if (extractionError !== undefined) {
    throwIfOperationAborted();
    if (isGtfsError(extractionError)) {
      throw extractionError;
    }
    throw new Error(
      `Could not extract GTFS ZIP: ${extractionError instanceof Error ? extractionError.message : 'Unknown error'}`,
      { cause: extractionError },
    );
  }
}
