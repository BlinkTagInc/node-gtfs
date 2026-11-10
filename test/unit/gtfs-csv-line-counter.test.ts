import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createCsvLineCounter } from '../../src/schedule/import/csv-lines.ts';
import type { GtfsCsvParseOptions } from '../../src/types/config.ts';

const cases: readonly {
  name: string;
  encoding: 'utf8' | 'utf16le' | 'latin1';
  withBom: boolean;
  options: Pick<GtfsCsvParseOptions, 'encoding'>;
}[] = [
  { name: 'default UTF-8', encoding: 'utf8', withBom: false, options: {} },
  { name: 'UTF-8 BOM', encoding: 'utf8', withBom: true, options: {} },
  {
    name: 'UTF-16 BOM detection',
    encoding: 'utf16le',
    withBom: true,
    options: {},
  },
  {
    name: 'explicit UTF-16 without BOM',
    encoding: 'utf16le',
    withBom: false,
    options: { encoding: 'utf16le' },
  },
  {
    name: 'UTF-8 BOM overriding UTF-16',
    encoding: 'utf8',
    withBom: true,
    options: { encoding: 'utf16le' },
  },
  {
    name: 'UTF-16 BOM overriding Latin-1',
    encoding: 'utf16le',
    withBom: true,
    options: { encoding: 'latin1' },
  },
  {
    name: 'Latin-1',
    encoding: 'latin1',
    withBom: false,
    options: { encoding: 'latin1' },
  },
];

for (const { name, encoding, withBom, options } of cases) {
  test(`line counter preserves physical byte offsets across ${name} chunk boundaries`, () => {
    const records = [
      'id,name\r\n',
      '1,"Café\r\nsecond"\r\n',
      '2,"nonadjacent\rX\nend"\r\n',
      '3,"consecutive\r\r\n\nend"\r\n',
      `4,${encoding === 'latin1' ? 'last' : '\u010a\u010d🚌'}\r\n`,
      '5,end\r',
    ];
    const bom = withBom ? '\uFEFF' : '';
    const bytes = Buffer.from(bom + records.join(''), encoding);
    let byteOffset = Buffer.byteLength(bom, encoding);
    const recordEndOffsets = records.map((record) => {
      byteOffset += Buffer.byteLength(record, encoding);
      return byteOffset;
    });
    const expectedLines = [1, 3, 6, 10, 11, 12];
    for (const chunkSize of [1, 2, 3, 7, 64]) {
      const counter = createCsvLineCounter(options);
      let nextRecord = 0;
      for (let start = 0; start < bytes.length; start += chunkSize) {
        const end = Math.min(start + chunkSize, bytes.length);
        counter.addChunk(bytes.subarray(start, end));
        while (nextRecord < recordEndOffsets.length) {
          const recordEnd = recordEndOffsets[nextRecord];
          assert.ok(recordEnd !== undefined);
          if (recordEnd > end) {
            break;
          }
          assert.equal(
            counter.getLineNumber(recordEnd),
            expectedLines[nextRecord],
            `chunk size ${chunkSize}, record ${nextRecord}`,
          );
          nextRecord += 1;
        }
      }
      counter.end();
      assert.equal(nextRecord, records.length);
      assert.equal(counter.getLineNumber(bytes.length + 1), 13);
      counter.end();
      assert.equal(counter.getLineNumber(bytes.length + 1), 13);
    }
  });
}

test('line counter always detects BOMs and ignores UTF-16 low-byte lookalikes', () => {
  // U+010A contains the LF byte but is not a line ending in UTF-16.
  const bytes = Buffer.from('\uFEFF\u010aA', 'utf16le');
  for (const options of [
    {},
    { encoding: 'utf16le' },
    { encoding: 'latin1' },
  ] as const) {
    const counter = createCsvLineCounter(options);
    for (const byte of bytes) {
      counter.addChunk(Buffer.from([byte]));
    }
    counter.end();
    assert.equal(counter.getLineNumber(bytes.length), 1);
  }
});

test('line counter handles empty input without advancing', () => {
  const counter = createCsvLineCounter({});
  counter.addChunk(Buffer.alloc(0));
  counter.end();
  assert.equal(counter.getLineNumber(0), 1);
});
