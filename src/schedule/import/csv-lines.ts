import type { GtfsCsvParseOptions } from '../../types/config.ts';
import { DEFAULT_GTFS_SCHEDULE_CONFIG } from '../../config/defaults.ts';

// Track physical line endings by byte offset: csv-parse's info.lines counts
// quoted CRLF pairs twice. info.bytes still identifies each record's end.
export function createCsvLineCounter(
  options: Pick<GtfsCsvParseOptions, 'encoding'>,
) {
  let utf16 =
    (options.encoding ?? DEFAULT_GTFS_SCHEDULE_CONFIG.import.csv.encoding) ===
    'utf16le';
  const bomPrefix: number[] = [];
  let byteOffset = 0;
  let previousByte = 0;
  let pendingCarriageReturn: number | undefined;
  const lineEndOffsets: number[] = [];
  let consumed = 0;
  let lineNumber = 1;

  function addCharacter(character: number, offset: number) {
    if (pendingCarriageReturn !== undefined) {
      const pair =
        character === 10 && offset === pendingCarriageReturn + (utf16 ? 2 : 1);
      lineEndOffsets.push(pair ? offset : pendingCarriageReturn);
      pendingCarriageReturn = undefined;
      if (pair) {
        return;
      }
    }
    if (character === 13) {
      pendingCarriageReturn = offset;
    } else if (character === 10) {
      lineEndOffsets.push(offset);
    }
  }

  return {
    addChunk(chunk: Buffer) {
      if (consumed > 0) {
        lineEndOffsets.splice(0, consumed);
        consumed = 0;
      }
      if (!utf16 && byteOffset >= 3) {
        const startOffset = byteOffset;
        byteOffset += chunk.length;
        let carriageReturn = chunk.indexOf(13);
        let lineFeed = chunk.indexOf(10);
        // Advance each search independently so LF-only files are scanned once,
        // not rescanned for a nonexistent CR after every line.
        while (carriageReturn !== -1 || lineFeed !== -1) {
          if (
            carriageReturn !== -1 &&
            (lineFeed === -1 || carriageReturn < lineFeed)
          ) {
            addCharacter(13, startOffset + carriageReturn + 1);
            carriageReturn = chunk.indexOf(13, carriageReturn + 1);
          } else {
            addCharacter(10, startOffset + lineFeed + 1);
            lineFeed = chunk.indexOf(10, lineFeed + 1);
          }
        }
        if (
          pendingCarriageReturn !== undefined &&
          pendingCarriageReturn < byteOffset
        ) {
          lineEndOffsets.push(pendingCarriageReturn);
          pendingCarriageReturn = undefined;
        }
        return;
      }
      for (const byte of chunk) {
        byteOffset += 1;
        if (byteOffset <= 3) {
          bomPrefix.push(byte);
        }
        if (byteOffset === 2 && previousByte === 0xff && byte === 0xfe) {
          utf16 = true;
        }
        if (
          byteOffset === 3 &&
          bomPrefix[0] === 0xef &&
          bomPrefix[1] === 0xbb &&
          byte === 0xbf
        ) {
          utf16 = false;
        }
        const character = utf16 ? (byte === 0 ? previousByte : -1) : byte;
        previousByte = byte;
        if (utf16 && byteOffset % 2 !== 0) {
          continue;
        }
        addCharacter(character, byteOffset);
      }
    },
    end() {
      if (pendingCarriageReturn !== undefined) {
        lineEndOffsets.push(pendingCarriageReturn);
        pendingCarriageReturn = undefined;
      }
    },
    getLineNumber(recordEndOffset: number) {
      while (consumed < lineEndOffsets.length) {
        const lineEndOffset = lineEndOffsets[consumed];
        if (lineEndOffset === undefined || lineEndOffset >= recordEndOffset) {
          break;
        }
        consumed += 1;
        lineNumber += 1;
      }
      return lineNumber;
    },
  };
}
