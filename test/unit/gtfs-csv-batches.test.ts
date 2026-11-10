import { createSourceFixtureFile } from '../helpers/source-fixture.ts';
import assert from 'node:assert/strict';
import { ReadStream } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';

import { readGtfsCsvRecordBatches } from '../../src/schedule/import/csv.ts';
import { readGtfsSourceRecordBatches } from '../../src/schedule/import/read-source.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';

for (const encoding of ['utf8', 'utf16le', 'latin1'] as const) {
  test(`CSV batches preserve every ${encoding} multiline record and position across read boundaries`, async (t) => {
    const count = 2051;
    const contents =
      'id,name\r\n' +
      Array.from(
        { length: count },
        (_, index) => `${index},"Café\r\nsecond"\r\n\r\n`,
      ).join('');
    const { filePath } = await createSourceFixtureFile(t, {
      filename: 'records.txt',
      contents: Buffer.from(contents, encoding),
    });
    const batches = [];
    for await (const batch of readGtfsCsvRecordBatches(filePath, {
      encoding,
    })) {
      assert.ok(batch.length > 0 && batch.length <= 512);
      batches.push(batch);
    }
    assert.ok(batches.some((batch) => batch.length === 512));
    const records = batches.flat();
    assert.equal(records.length, count);
    for (const [index, { record, position }] of records.entries()) {
      assert.deepEqual(record, { id: String(index), name: 'Café\r\nsecond' });
      assert.deepEqual(position, {
        kind: 'csv',
        recordNumber: index + 1,
        csvLineNumber: index * 3 + 3,
      });
      assert.equal(Object.isFrozen(position), true);
    }
  });
}

for (const encoding of ['utf8', 'utf16le', 'latin1'] as const) {
  test(`CSV positions distinguish mixed line endings across tiny ${encoding} reads`, async (t) => {
    const names = [
      'Café\r\nnext\rthird\nlast',
      'nonadjacent\rX\nend',
      'consecutive\r\r\n\nend',
      'trailing\r',
      encoding === 'latin1' ? 'last' : '\u010a\u010d\ud83d\ude8c',
    ];
    const contents =
      (encoding === 'latin1' ? '' : '\uFEFF') +
      'id,name\r\n' +
      names.map((name, index) => `${index},"${name}"`).join('\r\n');
    const { filePath } = await createSourceFixtureFile(t, {
      filename: 'mixed.txt',
      contents: Buffer.from(contents, encoding),
    });
    const read = ReadStream.prototype._read;
    for (const chunkSize of [1, 2, 3, 7, 64]) {
      const mock = t.mock.method(
        ReadStream.prototype,
        '_read',
        function (this: ReadStream, size: number) {
          read.call(
            this,
            String(this.path) === filePath ? Math.min(size, chunkSize) : size,
          );
        },
      );
      try {
        const actual = [];
        for await (const batch of readGtfsCsvRecordBatches(filePath, {
          encoding,
        })) {
          actual.push(...batch);
        }
        let line = 1;
        assert.deepEqual(
          actual,
          names.map((name, index) => {
            line += 1 + (name.match(/\r\n|\r|\n/gu)?.length ?? 0);
            return {
              record: { id: String(index), name },
              position: {
                kind: 'csv',
                recordNumber: index + 1,
                csvLineNumber: line,
              },
            };
          }),
          `Read size ${chunkSize}`,
        );
      } finally {
        mock.mock.restore();
      }
    }
  });
}

for (const outcome of ['return', 'input failure'] as const) {
  test(
    `CSV batches retain backpressure and close a paused reader after ${outcome}`,
    { timeout: 5000 },
    async (t) => {
      const contents =
        'id,name\n' + '1,a reasonably long stop name\n'.repeat(100_000);
      const { filePath } = await createSourceFixtureFile(t, {
        filename: 'records.txt',
        contents: contents,
      });
      const inputs = new Set<ReadStream>();
      const read = ReadStream.prototype._read;
      t.mock.method(
        ReadStream.prototype,
        '_read',
        function (this: ReadStream, size: number) {
          if (String(this.path) === filePath) {
            inputs.add(this);
          }
          read.call(this, size);
        },
      );
      const reader = readGtfsCsvRecordBatches(filePath, {});
      try {
        const first = await reader.next();
        assert.equal(first.done, false);
        assert.equal(first.value?.length, 512);
        await setImmediate();
        await setImmediate();
        assert.equal(inputs.size, 1);
        const [input] = inputs;
        assert.ok(input);
        assert.ok(
          input.bytesRead < Buffer.byteLength(contents) / 4,
          'A paused consumer must not read the whole file',
        );
        if (outcome === 'input failure') {
          const failure = Object.assign(
            new Error('Read failed after first batch'),
            { code: 'EIO' },
          );
          input.destroy(failure);
          await setImmediate();
          await assert.rejects(
            async () => {
              for await (const batch of reader) {
                assert.ok(batch.length <= 512);
              }
            },
            (error) => error === failure,
          );
        }
      } finally {
        await reader.return(undefined);
      }
      for (const input of inputs) {
        assert.equal(input.destroyed, true);
      }
    },
  );
}

test('structured validation batches preserve GeoJSON feature numbers and the partial final batch', async (t) => {
  const geometry = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  };
  const { filePath } = await createSourceFixtureFile(t, {
    filename: 'locations.geojson',
    contents: JSON.stringify({
      type: 'FeatureCollection',
      features: Array.from({ length: 1025 }, (_, index) => ({
        type: 'Feature',
        id: String(index),
        properties: { stop_name: `Area ${index}` },
        geometry,
      })),
    }),
  });
  let headerCalls = 0;
  const batches = [];
  for await (const batch of readGtfsSourceRecordBatches({
    filePath,
    table: compiledTableRegistry.locations,
    csv: {},
    onHeaders(headers) {
      headerCalls += 1;
      assert.ok(headers.includes('id'));
    },
  })) {
    batches.push(batch);
  }
  assert.equal(headerCalls, 1);
  assert.deepEqual(
    batches.map((batch) => batch.length),
    [512, 512, 1],
  );
  for (const [index, entry] of batches.flat().entries()) {
    assert.equal(entry.record.id, String(index));
    assert.equal(entry.validationRecord.id, String(index));
    assert.equal(entry.validationRecord.stop_name, `Area ${index}`);
    assert.deepEqual(entry.position, {
      kind: 'geojson',
      featureNumber: index + 1,
    });
  }
});
