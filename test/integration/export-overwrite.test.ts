import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WriteStream, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { EventEmitter, once } from 'node:events';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import {
  Gtfs,
  exportGtfs,
  importGtfs,
  GtfsErrorCode,
  isGtfsError,
  type GtfsExportConfig,
} from '../../src/index.ts';

async function fixture(
  t: TestContext,
  adapter: 'native' | 'kysely' = 'native',
) {
  const directory = await fs.mkdtemp(
    path.join(tmpdir(), 'gtfs-export-overwrite-'),
  );
  const outputDirectory = path.join(directory, 'feed');
  const sqlite = new Database(':memory:');
  const portable = new Kysely({
    dialect: new SqliteDialect({ database: sqlite }),
  });
  const database = {
    client: adapter === 'native' ? sqlite : portable,
  };
  const gtfs = new Gtfs({
    database,
    export: { outputDirectory },
    reporting: { level: 'silent' },
  });
  t.after(async () => {
    await gtfs.close();
    await portable.destroy();
    await fs.rm(directory, { recursive: true, force: true });
  });
  await importGtfs({
    database,
    sources: [{ schedule: { path: 'test/fixtures/complete' } }],
    reporting: { level: 'silent' },
  });
  return { directory, outputDirectory, database, gtfs, sqlite };
}

function failRouteWrite(t: TestContext) {
  const construct = WriteStream.prototype._construct;
  assert.ok(construct);
  t.mock.method(
    WriteStream.prototype,
    '_construct',
    function (this: WriteStream, callback: (error?: Error | null) => void) {
      if (path.basename(String(this.path)) === 'routes.txt') {
        callback(new Error('Injected export write failure'));
        return;
      }
      construct.call(this, callback);
    },
    {},
  );
}

for (const adapter of ['native', 'kysely'] as const) {
  for (const api of ['standalone', 'instance'] as const) {
    test(`${adapter} ${api}: refuses existing output by default and replaces it only after all files are written`, async (t) => {
      const { directory, outputDirectory, database, gtfs } = await fixture(
        t,
        adapter,
      );
      const run = (options: GtfsExportConfig = {}) =>
        api === 'instance'
          ? gtfs.export(options)
          : exportGtfs({
              database,
              export: { outputDirectory, ...options },
              reporting: { level: 'silent' },
            });
      const first = await run();
      const oldAgency = await fs.readFile(
        path.join(outputDirectory, 'agency.txt'),
      );
      await fs.mkdir(path.join(outputDirectory, 'notes'));
      await fs.writeFile(
        path.join(outputDirectory, 'notes', 'keep-until-success.txt'),
        'unrelated',
      );
      await fs.writeFile(
        path.join(outputDirectory, 'directions.txt'),
        'stale extension',
      );
      await assert.rejects(run(), {
        code: GtfsErrorCode.EXPORT_OUTPUT_EXISTS,
        category: 'export',
        details: { outputDirectory, overwrite: false },
      });
      await assert.rejects(run({ overwrite: false }), {
        code: GtfsErrorCode.EXPORT_OUTPUT_EXISTS,
      });
      assert.deepEqual(
        await fs.readFile(path.join(outputDirectory, 'agency.txt')),
        oldAgency,
      );
      assert.equal(
        await fs.readFile(
          path.join(outputDirectory, 'notes', 'keep-until-success.txt'),
          'utf8',
        ),
        'unrelated',
      );
      const construct = WriteStream.prototype._construct;
      assert.ok(construct);
      let inspected = false;
      t.mock.method(
        WriteStream.prototype,
        '_construct',
        function (this: WriteStream, callback: (error?: Error | null) => void) {
          assert.notEqual(path.dirname(String(this.path)), outputDirectory);
          inspected = true;
          construct.call(this, callback);
        },
        {},
      );
      const result = await run({ overwrite: true });
      assert.equal(inspected, true);
      assert.equal(result.outputDirectory, outputDirectory);
      assert.deepEqual(result.files, first.files);
      assert.deepEqual(
        (await fs.readdir(outputDirectory)).sort(),
        result.files.map(({ filename }) => filename).sort(),
      );
      assert.deepEqual(await fs.readdir(directory), ['feed']);
    });

    test(`${adapter} ${api}: failed overwrite removes incomplete output and preserves previous output`, async (t) => {
      const { directory, outputDirectory, database, gtfs } = await fixture(
        t,
        adapter,
      );
      const previous = await gtfs.export();
      const oldFiles = await Promise.all(
        previous.files.map(
          async ({ filename }) =>
            [
              filename,
              await fs.readFile(path.join(outputDirectory, filename)),
            ] as const,
        ),
      );
      await fs.writeFile(
        path.join(outputDirectory, 'notes.md'),
        'Keep my notes',
      );
      failRouteWrite(t);
      const options = { outputDirectory, overwrite: true };
      await assert.rejects(
        api === 'instance'
          ? gtfs.export(options)
          : exportGtfs({
              database,
              export: options,
              reporting: { level: 'silent' },
            }),
        (error) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.EXPORT_WRITE_FAILED);
          assert.equal(error.details?.filename, 'routes.txt');
          assert.equal(error.details?.outputDirectory, outputDirectory);
          return true;
        },
      );
      for (const [filename, contents] of oldFiles) {
        assert.deepEqual(
          await fs.readFile(path.join(outputDirectory, filename)),
          contents,
        );
      }
      assert.equal(
        await fs.readFile(path.join(outputDirectory, 'notes.md'), 'utf8'),
        'Keep my notes',
      );
      assert.deepEqual(await fs.readdir(directory), ['feed']);
    });
  }
}

for (const overwrite of [false, true]) {
  test(`cleanup failure reports incomplete output without losing previous output; overwrite=${overwrite}`, async (t) => {
    const { directory, outputDirectory, gtfs } = await fixture(t);
    if (overwrite) {
      await fs.mkdir(outputDirectory);
      await fs.writeFile(
        path.join(outputDirectory, 'previous.txt'),
        'Previous output',
      );
    }
    failRouteWrite(t);
    const remove = fs.rm;
    t.mock.method(
      fs,
      'rm',
      async (...[target, options]: Parameters<typeof fs.rm>) => {
        if (
          target === outputDirectory ||
          (path.dirname(String(target)) === directory &&
            path.basename(String(target)).startsWith('.node-gtfs-export-'))
        ) {
          throw new Error('Injected cleanup failure');
        }
        return remove(target, options);
      },
    );
    let partialDirectory: string | undefined;
    await assert.rejects(gtfs.export({ overwrite }), (error) => {
      assert.ok(isGtfsError(error));
      assert.equal(error.code, GtfsErrorCode.EXPORT_WRITE_FAILED);
      assert.equal(error.details?.filename, 'routes.txt');
      assert.equal(error.details?.outputDirectory, outputDirectory);
      assert.equal(error.details?.cleanupFailed, true);
      const remaining = error.details?.partialOutputDirectory;
      assert.equal(typeof remaining, 'string');
      partialDirectory = remaining as string;
      assert.ok(error.cause instanceof AggregateError);
      assert.equal(error.cause.errors.length, 2);
      return true;
    });
    assert.ok(partialDirectory);
    assert.ok((await fs.readdir(partialDirectory)).includes('agency.txt'));
    assert.equal(
      (await fs.readdir(directory)).some((name) => name.endsWith('.lock')),
      false,
    );
    if (overwrite) {
      assert.notEqual(partialDirectory, outputDirectory);
      assert.deepEqual(await fs.readdir(outputDirectory), ['previous.txt']);
      assert.equal(
        await fs.readFile(path.join(outputDirectory, 'previous.txt'), 'utf8'),
        'Previous output',
      );
    } else {
      assert.equal(partialDirectory, outputDirectory);
    }
  });
}

test('publication failure restores the previous directory', async (t) => {
  const { directory, outputDirectory, gtfs } = await fixture(t);
  await fs.mkdir(outputDirectory);
  await fs.writeFile(
    path.join(outputDirectory, 'previous.txt'),
    'Previous output',
  );
  const rename = fs.rename;
  t.mock.method(
    fs,
    'rename',
    async (...[from, to]: Parameters<typeof fs.rename>) => {
      if (path.basename(String(from)) === 'new' && to === outputDirectory) {
        throw new Error('Injected rename failure');
      }
      return rename(from, to);
    },
  );
  await assert.rejects(gtfs.export({ overwrite: true }), {
    code: GtfsErrorCode.EXPORT_WRITE_FAILED,
  });
  assert.deepEqual(await fs.readdir(directory), ['feed']);
  assert.equal(
    await fs.readFile(path.join(outputDirectory, 'previous.txt'), 'utf8'),
    'Previous output',
  );
});

test(
  'a concurrent overwrite cannot disturb an export being published',
  { timeout: 5_000 },
  async (t) => {
    const { directory, outputDirectory, database, gtfs } = await fixture(t);
    await gtfs.export();
    const gate = new EventEmitter();
    const ready = once(gate, 'ready');
    const proceed = once(gate, 'proceed');
    const rename = fs.rename;
    t.mock.method(
      fs,
      'rename',
      async (...[from, to]: Parameters<typeof fs.rename>) => {
        if (from === outputDirectory) {
          gate.emit('ready');
          await proceed;
        }
        return rename(from, to);
      },
    );
    const first = gtfs.export({ overwrite: true });
    try {
      await ready;
      await assert.rejects(
        exportGtfs({ database, export: { outputDirectory, overwrite: true } }),
        (error) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, GtfsErrorCode.EXPORT_WRITE_FAILED);
          assert.equal(error.details?.reason, 'output-reservation-failed');
          return true;
        },
      );
    } finally {
      gate.emit('proceed');
      await first;
    }
    assert.deepEqual(await fs.readdir(directory), ['feed']);
  },
);

test('replacement refuses a destination changed during generation', async (t) => {
  const { directory, outputDirectory, gtfs } = await fixture(t);
  await gtfs.export();
  const saved = path.join(directory, 'saved');
  const construct = WriteStream.prototype._construct;
  assert.ok(construct);
  let changed = false;
  t.mock.method(
    WriteStream.prototype,
    '_construct',
    function (this: WriteStream, callback: (error?: Error | null) => void) {
      if (!changed) {
        changed = true;
        renameSync(outputDirectory, saved);
        mkdirSync(outputDirectory);
        writeFileSync(
          path.join(outputDirectory, 'someone-else.txt'),
          'Keep this',
        );
      }
      construct.call(this, callback);
    },
    {},
  );
  await assert.rejects(gtfs.export({ overwrite: true }), (error) => {
    assert.ok(isGtfsError(error));
    assert.equal(error.details?.reason, 'output-changed');
    return true;
  });
  assert.deepEqual((await fs.readdir(directory)).sort(), ['feed', 'saved']);
  assert.equal(
    await fs.readFile(path.join(outputDirectory, 'someone-else.txt'), 'utf8'),
    'Keep this',
  );
});

test('rollback failure retains previous output in a reported recovery directory', async (t) => {
  const { outputDirectory, gtfs } = await fixture(t);
  await fs.mkdir(outputDirectory);
  await fs.writeFile(
    path.join(outputDirectory, 'previous.txt'),
    'Recoverable output',
  );
  const rename = fs.rename;
  t.mock.method(
    fs,
    'rename',
    async (...[from, to]: Parameters<typeof fs.rename>) => {
      if (to === outputDirectory) {
        throw new Error('Injected publication and rollback failure');
      }
      return rename(from, to);
    },
  );
  let recoveryDirectory = '';
  await assert.rejects(gtfs.export({ overwrite: true }), (error) => {
    assert.ok(isGtfsError(error));
    assert.equal(error.code, GtfsErrorCode.EXPORT_WRITE_FAILED);
    const recovery = error.details?.recoveryDirectory;
    assert.equal(typeof recovery, 'string');
    recoveryDirectory = recovery as string;
    return true;
  });
  assert.equal(
    await fs.readFile(path.join(recoveryDirectory, 'previous.txt'), 'utf8'),
    'Recoverable output',
  );
});

test('refuses existing empty directories, files, and symbolic links without changing them', async (t) => {
  const { directory, outputDirectory, gtfs } = await fixture(t);
  await fs.mkdir(outputDirectory);
  await assert.rejects(gtfs.export(), {
    code: GtfsErrorCode.EXPORT_OUTPUT_EXISTS,
  });
  await fs.rmdir(outputDirectory);
  await fs.writeFile(outputDirectory, 'Not a directory');
  await assert.rejects(gtfs.export({ overwrite: true }), {
    code: GtfsErrorCode.EXPORT_WRITE_FAILED,
  });
  assert.equal(await fs.readFile(outputDirectory, 'utf8'), 'Not a directory');
  await fs.unlink(outputDirectory);
  const other = path.join(directory, 'other');
  await fs.mkdir(other);
  await fs.writeFile(path.join(other, 'keep.txt'), 'Do not follow');
  await fs.symlink(other, outputDirectory, 'dir');
  await assert.rejects(gtfs.export(), {
    code: GtfsErrorCode.EXPORT_OUTPUT_EXISTS,
  });
  await assert.rejects(gtfs.export({ overwrite: true }), {
    code: GtfsErrorCode.EXPORT_WRITE_FAILED,
  });
  assert.equal(
    await fs.readFile(path.join(other, 'keep.txt'), 'utf8'),
    'Do not follow',
  );
});

test('rejects replacement of root, home, or a working-directory ancestor before filesystem writes', async (t) => {
  const { gtfs } = await fixture(t);
  t.mock.method(fs, 'mkdir', async () => {
    assert.fail(
      'Unsafe destinations must be rejected before filesystem writes',
    );
  });
  for (const outputDirectory of [
    path.parse(process.cwd()).root,
    homedir(),
    process.cwd(),
    path.dirname(process.cwd()),
  ]) {
    await assert.rejects(
      gtfs.export({ outputDirectory, overwrite: true }),
      (error) => {
        assert.ok(isGtfsError(error));
        assert.equal(error.code, GtfsErrorCode.EXPORT_WRITE_FAILED);
        assert.equal(error.details?.reason, 'unsafe-output-directory');
        return true;
      },
    );
  }
});

test('validates overwrite values in config and instance overrides, including explicit false over true', async (t) => {
  const { database, outputDirectory } = await fixture(t);
  for (const overwrite of ['true', 1, null, {}]) {
    assert.throws(
      () => new Gtfs({ database, export: { overwrite } } as never),
      { code: GtfsErrorCode.CONFIG_INVALID },
    );
  }
  const gtfs = new Gtfs({
    database,
    export: { outputDirectory, overwrite: true },
  });
  t.after(() => gtfs.close());
  await gtfs.export();
  await gtfs.export();
  await assert.rejects(gtfs.export({ overwrite: false }), {
    code: GtfsErrorCode.EXPORT_OUTPUT_EXISTS,
  });
  for (const overwrite of ['true', 1, null, {}]) {
    await assert.rejects(gtfs.export({ overwrite } as never), {
      code: GtfsErrorCode.CONFIG_INVALID,
    });
  }
});
