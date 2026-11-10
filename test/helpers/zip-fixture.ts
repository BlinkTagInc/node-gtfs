import { crc32, deflateRawSync } from 'node:zlib';

export interface ZipFixtureEntry {
  readonly name: string;
  readonly content: string | Buffer;
  readonly unixMode?: number;
  readonly deflate?: boolean;
  readonly declaredSize?: number;
  readonly checksum?: number;
}

// Store entries verbatim: ordinary ZIP writers may sanitize malicious names
// before the extraction code under test ever sees them.
export function encodeZipFixture(entries: readonly ZipFixtureEntry[]): Buffer {
  const localRecords: Buffer[] = [];
  const directoryRecords: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const content = Buffer.from(entry.content);
    const checksum = entry.checksum ?? crc32(content);
    const compressed = entry.deflate ? deflateRawSync(content) : content;
    const size = entry.declaredSize ?? content.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6); // UTF-8.
    local.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    localRecords.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4); // Unix creator, ZIP version 2.0.
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((entry.unixMode ?? 0o100644) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    directoryRecords.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(directoryRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localRecords, directory, end]);
}
