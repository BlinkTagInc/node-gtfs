import assert from 'node:assert/strict';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';

import { extractZipArchive } from '../../src/io/zip.ts';
import { encodeZipFixture } from '../helpers/zip-fixture.ts';
import { DEFAULT_ARCHIVE_LIMITS } from '../../src/config/defaults.ts';
import { GtfsErrorCode, isGtfsError } from '../../src/diagnostics/errors.ts';

// Inspect our stored ZIP32 fixtures directly, independently of the extractor.
function readStoredFixtureEntries(archive: Buffer) {
  const endOffset = archive.length - 22;
  assert.equal(archive.readUInt32LE(endOffset), 0x06054b50);
  const entryCount = archive.readUInt16LE(endOffset + 10);
  let offset = archive.readUInt32LE(endOffset + 16);
  return Array.from({ length: entryCount }, () => {
    assert.equal(archive.readUInt32LE(offset), 0x02014b50);
    assert.equal(archive.readUInt16LE(offset + 10), 0);
    const nameLength = archive.readUInt16LE(offset + 28);
    const name = archive.toString(
      'utf8',
      offset + 46,
      offset + 46 + nameLength,
    );
    const localOffset = archive.readUInt32LE(offset + 42);
    assert.equal(archive.readUInt32LE(localOffset), 0x04034b50);
    assert.equal(archive.readUInt16LE(localOffset + 8), 0);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    assert.equal(
      archive.toString(
        'utf8',
        localOffset + 30,
        localOffset + 30 + localNameLength,
      ),
      name,
    );
    const dataOffset =
      localOffset +
      30 +
      localNameLength +
      archive.readUInt16LE(localOffset + 28);
    const size = archive.readUInt32LE(offset + 20);
    const entry = {
      name,
      content: archive.subarray(dataOffset, dataOffset + size).toString('utf8'),
      unixMode: archive.readUInt32LE(offset + 38) >>> 16,
      creator: archive.readUInt16LE(offset + 4) >>> 8,
    };
    offset +=
      46 +
      nameLength +
      archive.readUInt16LE(offset + 30) +
      archive.readUInt16LE(offset + 32);
    return entry;
  });
}

async function prepareExtraction(t: TestContext) {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-zip-safety-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const destination = path.join(directory, 'staging', 'extracted');
  await mkdir(destination, { recursive: true });
  const outsidePath = path.join(directory, 'outside.txt');
  await writeFile(outsidePath, 'untouched');
  return {
    directory,
    destination,
    outsidePath,
    archivePath: path.join(directory, 'feed.zip'),
  };
}

for (const entryName of [
  '../../outside.txt',
  'nested/../../../outside.txt',
  '..\\..\\outside.txt',
  'absolute',
]) {
  test(`rejects ZIP traversal ${entryName} without extracting any entry`, async (t) => {
    const { destination, outsidePath, archivePath } =
      await prepareExtraction(t);
    const name = entryName === 'absolute' ? outsidePath : entryName;
    await writeFile(
      archivePath,
      encodeZipFixture([
        {
          name: 'agency.txt',
          content: 'This safe entry must not be extracted either',
        },
        { name, content: 'overwritten' },
      ]),
    );
    const entries = readStoredFixtureEntries(await readFile(archivePath));
    assert.deepEqual(
      entries.map(({ name, content }) => ({ name, content })),
      [
        {
          name: 'agency.txt',
          content: 'This safe entry must not be extracted either',
        },
        { name, content: 'overwritten' },
      ],
    );
    await assert.rejects(
      extractZipArchive(archivePath, destination),
      /Could not extract GTFS ZIP: (invalid relative path|invalid characters in fileName|absolute path)/,
    );
    assert.equal(await readFile(outsidePath, 'utf8'), 'untouched');
    assert.deepEqual(await readdir(destination), []);
  });
}

test('Unix symlink entries are extracted as regular files, not followed outside staging', async (t) => {
  const { destination, outsidePath, archivePath } = await prepareExtraction(t);
  await writeFile(
    archivePath,
    encodeZipFixture([
      { name: 'link', content: '../../outside.txt', unixMode: 0o120777 },
    ]),
  );
  assert.deepEqual(readStoredFixtureEntries(await readFile(archivePath)), [
    {
      name: 'link',
      content: '../../outside.txt',
      unixMode: 0o120777,
      creator: 3,
    },
  ]);
  await extractZipArchive(archivePath, destination);
  const linkPath = path.join(destination, 'link');
  assert.equal((await lstat(linkPath)).isSymbolicLink(), false);
  assert.equal((await lstat(linkPath)).isFile(), true);
  assert.equal(await readFile(linkPath, 'utf8'), '../../outside.txt');
  assert.equal(await readFile(outsidePath, 'utf8'), 'untouched');
});

test('a symlink entry followed by a child entry cannot write through the link', async (t) => {
  const { directory, destination, outsidePath, archivePath } =
    await prepareExtraction(t);
  await writeFile(
    archivePath,
    encodeZipFixture([
      { name: 'link', content: '../..', unixMode: 0o120777 },
      { name: 'link/outside.txt', content: 'overwritten' },
    ]),
  );
  await assert.rejects(
    extractZipArchive(archivePath, destination),
    /Could not extract GTFS ZIP/,
  );
  assert.equal(await readFile(outsidePath, 'utf8'), 'untouched');
  assert.equal(
    (await lstat(path.join(destination, 'link'))).isSymbolicLink(),
    false,
  );
  assert.deepEqual((await readdir(directory)).sort(), [
    'feed.zip',
    'outside.txt',
    'staging',
  ]);
});

for (const limit of [
  'maxCompressedBytes',
  'maxEntries',
  'maxExtractedFileBytes',
  'maxExtractedTotalBytes',
] as const) {
  test(`rejects ZIP ${limit} before writing any files`, async (t) => {
    const { archivePath, destination } = await prepareExtraction(t);
    await writeFile(
      archivePath,
      encodeZipFixture([
        { name: 'one.txt', content: '123456', deflate: true },
        { name: 'two.txt', content: '123456', deflate: true },
      ]),
    );
    const maximum = limit === 'maxExtractedTotalBytes' ? 10 : 1;
    await assert.rejects(
      extractZipArchive(archivePath, destination, {
        ...DEFAULT_ARCHIVE_LIMITS,
        [limit]: maximum,
      }),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.ZIP_LIMIT_EXCEEDED);
        assert.equal(error.category, 'zip');
        assert.equal(error.details?.sourcePath, archivePath);
        assert.equal(error.details?.limit, limit);
        assert.equal(error.details?.maximum, maximum);
        assert.ok(Number(error.details?.actual) > maximum);
        assert.ok(
          error.message.includes(`sources[].schedule.import.archive.${limit}`),
        );
        return true;
      },
    );
    assert.deepEqual(await readdir(destination), []);
  });
}

test('duplicate ZIP names still count toward the entry limit', async (t) => {
  const { archivePath, destination } = await prepareExtraction(t);
  await writeFile(
    archivePath,
    encodeZipFixture(
      Array.from({ length: 10 }, () => ({ name: 'same.txt', content: '' })),
    ),
  );
  await assert.rejects(
    extractZipArchive(archivePath, destination, {
      ...DEFAULT_ARCHIVE_LIMITS,
      maxEntries: 2,
    }),
    { code: 'GTFS_ZIP_LIMIT_EXCEEDED' },
  );
  assert.deepEqual(await readdir(destination), []);
});

for (const limit of [
  'maxExtractedFileBytes',
  'maxExtractedTotalBytes',
] as const) {
  test(
    `bounds actual inflated bytes with forged ZIP sizes (${limit})`,
    { timeout: 5000 },
    async (t) => {
      const { archivePath, destination } = await prepareExtraction(t);
      await writeFile(
        archivePath,
        encodeZipFixture([
          {
            name: 'oversized.txt',
            content: Buffer.alloc(1024 * 1024, 65),
            deflate: true,
            declaredSize: 1,
          },
        ]),
      );
      await assert.rejects(
        extractZipArchive(archivePath, destination, {
          ...DEFAULT_ARCHIVE_LIMITS,
          [limit]: 1024,
        }),
        (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.ZIP_LIMIT_EXCEEDED);
          assert.equal(error.details?.limit, limit);
          assert.equal(error.details?.entryName, 'oversized.txt');
          return true;
        },
      );
      assert.ok(
        (await readFile(path.join(destination, 'oversized.txt'))).length <=
          1024,
      );
    },
  );
}

for (const deflate of [false, true]) {
  test(`accepts ZIP boundaries exactly (${deflate ? 'deflate' : 'stored'})`, async (t) => {
    const { archivePath, destination } = await prepareExtraction(t);
    const buffer = encodeZipFixture([
      { name: 'agency.txt', content: '123456', deflate },
    ]);
    await writeFile(archivePath, buffer);
    await extractZipArchive(archivePath, destination, {
      maxCompressedBytes: buffer.length,
      maxEntries: 1,
      maxExtractedFileBytes: 6,
      maxExtractedTotalBytes: 6,
    });
    assert.equal(
      await readFile(path.join(destination, 'agency.txt'), 'utf8'),
      '123456',
    );
  });
}

test('rejects a bad CRC even when the extracted size matches', async (t) => {
  const { archivePath, destination } = await prepareExtraction(t);
  await writeFile(
    archivePath,
    encodeZipFixture([
      { name: 'agency.txt', content: '123456', checksum: 0, deflate: true },
    ]),
  );
  await assert.rejects(extractZipArchive(archivePath, destination), /checksum/);
});
