import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../diagnostics/errors.ts';
import type { GtfsScheduleArchiveConfig } from '../types/config.ts';

export type ArchiveLimits = Required<GtfsScheduleArchiveConfig>;

export function assertInputLimit(options: {
  value: number;
  maximum: number;
  limit: string;
  kind: 'download' | 'zip';
  details?: Readonly<Record<string, unknown>>;
}): void {
  const { value, maximum, limit, kind, details } = options;
  if (value <= maximum) {
    return;
  }
  const configPath =
    limit === 'maxDownloadBytes'
      ? 'sources[].realtime.feeds[].maxDownloadBytes'
      : `sources[].schedule.import.archive.${limit}`;
  throw new GtfsError(
    `GTFS ${kind === 'zip' ? 'ZIP' : 'download'} exceeds ${limit} limit of ${maximum}; raise the \`${configPath}\` configuration option only for a trusted feed`,
    {
      code:
        kind === 'zip'
          ? GtfsErrorCode.ZIP_LIMIT_EXCEEDED
          : GtfsErrorCode.DOWNLOAD_TOO_LARGE,
      category:
        kind === 'zip' ? GtfsErrorCategory.ZIP : GtfsErrorCategory.DOWNLOAD,
      details: { ...details, limit, maximum, actual: value },
    },
  );
}

export async function* readBoundedResponse(options: {
  response: Response;
  maxBytes: number;
  limit: string;
  details: Readonly<Record<string, unknown>>;
}): AsyncGenerator<Uint8Array> {
  const { response, maxBytes, limit, details } = options;
  const reader = response.body?.getReader();
  try {
    const declaredLength = response.headers.get('content-length');
    if (declaredLength !== null && /^\d+$/u.test(declaredLength)) {
      assertInputLimit({
        value: Number(declaredLength),
        maximum: maxBytes,
        limit,
        kind: 'download',
        details,
      });
    }
    let receivedBytes = 0;
    while (reader !== undefined) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      receivedBytes += value.byteLength;
      assertInputLimit({
        value: receivedBytes,
        maximum: maxBytes,
        limit,
        kind: 'download',
        details,
      });
      yield value;
    }
  } finally {
    try {
      await reader?.cancel();
    } catch {
      // Preserve the original download or write failure.
    }
    reader?.releaseLock();
  }
}

export async function bufferBoundedResponse(
  options: Parameters<typeof readBoundedResponse>[0],
): Promise<Buffer> {
  const blocks: Buffer[] = [];
  let block = Buffer.allocUnsafe(Math.min(options.maxBytes, 64 * 1024));
  let blockBytes = 0;
  let totalBytes = 0;
  // Coalesce small network chunks so their object overhead cannot grow with
  // every byte of the response. Only Realtime needs an in-memory payload.
  for await (const chunk of readBoundedResponse(options)) {
    let offset = 0;
    while (offset < chunk.byteLength) {
      const length = Math.min(
        block.byteLength - blockBytes,
        chunk.byteLength - offset,
      );
      block.set(chunk.subarray(offset, offset + length), blockBytes);
      blockBytes += length;
      totalBytes += length;
      offset += length;
      if (blockBytes === block.byteLength) {
        blocks.push(block);
        block = Buffer.allocUnsafe(Math.min(options.maxBytes, 64 * 1024));
        blockBytes = 0;
      }
    }
  }
  if (blockBytes > 0) {
    blocks.push(block.subarray(0, blockBytes));
  }
  return Buffer.concat(blocks, totalBytes);
}
