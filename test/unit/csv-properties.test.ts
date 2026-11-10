import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import fc from 'fast-check';
import { createGtfsCsvParser } from '../../src/schedule/import/csv.ts';
import { propertyOptions } from '../helpers/property-options.ts';

const cell = fc
  .array(
    fc.constantFrom(
      'a',
      '0',
      ',',
      ';',
      '|',
      '"',
      "'",
      '\\',
      '\r',
      '\n',
      ' ',
      '\t',
      'é',
      '東京',
      '💡',
    ),
    { maxLength: 16 },
  )
  .map((parts) => parts.join(''));
const headers = ['id', 'stop,name', '__proto__', 'constructor', 'id'];

test('property: CSV quoting preserves values across byte boundaries and duplicate headers', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.tuple(cell, cell, cell, cell, cell), { maxLength: 6 }),
      fc.constantFrom(',', ';', '|', '💡'),
      fc.constantFrom('"', "'"),
      fc.constantFrom('\n', '\r\n'),
      fc.boolean(),
      fc.boolean(),
      fc.integer({ min: 1, max: 17 }),
      async (
        rows,
        delimiter,
        quote,
        newline,
        bom,
        trailingNewline,
        chunkSize,
      ) => {
        // An independent, deliberately small encoder: quote every field and double quotes.
        const encode = (fields: readonly string[]) =>
          fields
            .map(
              (field) => quote + field.replaceAll(quote, quote + quote) + quote,
            )
            .join(delimiter);
        const input = Buffer.from(
          (bom ? '\uFEFF' : '') +
            [headers, ...rows].map(encode).join(newline) +
            (trailingNewline ? newline : ''),
        );
        const chunks = [];
        for (let offset = 0; offset < input.length; offset += chunkSize) {
          chunks.push(input.subarray(offset, offset + chunkSize));
        }
        const seenHeaders: (readonly string[])[] = [];
        const parser = createGtfsCsvParser(
          { delimiter, quote, escape: quote },
          (value) => {
            seenHeaders.push(value);
          },
        );
        Readable.from(chunks).pipe(parser);
        const actual = [];
        for await (const { record } of parser) {
          assert.equal(Object.getPrototypeOf(record), Object.prototype);
          actual.push(record);
        }
        assert.deepEqual(seenHeaders, [headers]);
        assert.deepEqual(
          actual,
          rows.map((row) =>
            Object.fromEntries(
              headers.map((header, index) => [header, row[index]]),
            ),
          ),
        );
      },
    ),
    propertyOptions(13001, 100),
  );
});
