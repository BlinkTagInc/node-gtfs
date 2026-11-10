import { createReadStream } from 'node:fs';
import { parse, type InfoRecord, type Options, type Parser } from 'csv-parse';
import type { GtfsCsvSourcePosition } from '../../diagnostics/position.ts';
import type { GtfsCsvParseOptions } from '../../types/config.ts';
import { resolveCsvParseOptions } from '../../config/csv.ts';
import { createCsvLineCounter } from './csv-lines.ts';
import {
  throwConfigIssues,
  type ConfigValidationContext,
} from '../../config/validation.ts';

type GtfsCsvHeaderHandler = (headers: readonly string[]) => void;

interface ParsedGtfsCsvRecord {
  readonly record: Record<string, string>;
  readonly position: GtfsCsvSourcePosition;
}

interface GtfsCsvParserRecord {
  readonly record: Record<string, string>;
  readonly info: Pick<InfoRecord, 'bytes' | 'records'>;
}

// csv-parse's array-mode overload omits the custom on_record result type.
const parseRecordArrays = parse as (
  options: Options<GtfsCsvParserRecord, string[]>,
) => Parser;

export function createGtfsCsvParser(
  csv: GtfsCsvParseOptions,
  onHeaders?: GtfsCsvHeaderHandler,
): Parser {
  const context: ConfigValidationContext = {
    format: 'javascript',
    operation: 'import',
    issues: [],
  };
  const options = resolveCsvParseOptions(csv, 'csv', context);
  if (context.issues.length > 0) {
    throwConfigIssues(context.issues);
  }
  let headers: readonly string[] | undefined;
  return parseRecordArrays({
    encoding: options.encoding,
    bom: true,
    delimiter: options.delimiter,
    quote: options.quote,
    escape: options.escape,
    trim: options.trim,
    skip_empty_lines: options.skipEmptyLines,
    relax_quotes: options.relaxQuotes,
    // Array mode still validates every record's width against the header.
    // Assemble objects here to avoid defining a descriptor for every field.
    columns: false,
    info: false,
    raw: false,
    on_record(values: string[], info: InfoRecord) {
      if (headers === undefined) {
        headers = values;
        onHeaders?.(headers);
        return null;
      }
      const record: Record<string, string> = {};
      let index = 0;
      for (const value of values) {
        const field = headers[index];
        if (field === undefined) {
          throw new Error('CSV record has more fields than its header');
        }
        if (field === '__proto__') {
          Object.defineProperty(record, field, {
            value,
            enumerable: true,
            writable: true,
            configurable: true,
          });
        } else {
          record[field] = value;
        }
        index += 1;
      }
      return {
        record,
        info: { bytes: info.bytes, records: info.records - 1 },
      };
    },
  });
}

export async function* readGtfsCsvRecordBatches(
  filePath: string,
  csv: GtfsCsvParseOptions,
  onHeaders?: GtfsCsvHeaderHandler,
): AsyncGenerator<readonly ParsedGtfsCsvRecord[]> {
  const parser = createGtfsCsvParser(csv, onHeaders);
  const input = createReadStream(filePath);
  const lines = createCsvLineCounter(csv);
  input.on('data', lines.addChunk);
  input.on('end', lines.end);
  // pipe() does not forward input errors to the parser's async iterator.
  input.on('error', (error) => parser.destroy(error));

  try {
    input.pipe(parser);
    for await (const first of parser) {
      const batch: ParsedGtfsCsvRecord[] = [];
      let parsed = first;
      // Drain already-buffered records without a promise for each one. The
      // limit bounds each handoff; stream backpressure still bounds read-ahead.
      do {
        const { record, info } = parsed as GtfsCsvParserRecord;
        batch.push({
          record,
          position: Object.freeze({
            kind: 'csv',
            recordNumber: info.records,
            csvLineNumber: lines.getLineNumber(info.bytes),
          }),
        });
        if (batch.length === 512) {
          break;
        }
        parsed = parser.read();
      } while (parsed !== null);
      yield batch;
    }
  } finally {
    input.destroy();
    parser.destroy();
  }
}
