import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const archive = process.argv[2];
if (!archive) {
  throw new Error('Usage: node scripts/check-runtime.mjs <package.tgz>');
}
const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(
  await readFile(path.join(root, 'package.json'), 'utf8'),
);
const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-runtime-'));
const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: directory,
    encoding: 'utf8',
    timeout: 180_000,
    env: {
      ...process.env,
      PATH: [path.dirname(process.execPath), process.env.PATH]
        .filter(Boolean)
        .join(path.delimiter),
      npm_config_cache: path.join(directory, 'npm-cache'),
    },
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')}: ${result.error?.message ?? result.signal ?? ''}\n${result.stdout}${result.stderr}`,
  );
  return result.stdout;
};

try {
  console.log(
    `Checking installed package on ${process.version} (${process.platform}/${process.arch}, Node-API ${process.versions.napi}) with npm ${run('npm', ['--version']).trim()}`,
  );
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  run('npm', [
    'install',
    '--engine-strict',
    '--no-audit',
    '--no-fund',
    path.resolve(archive),
    ...['pg', 'pg-cursor', 'mysql2'].map(
      (name) => `${name}@${manifest.devDependencies[name]}`,
    ),
  ]);
  await writeFile(
    path.join(directory, 'smoke.mjs'),
    `import assert from 'node:assert/strict';
import { Gtfs } from 'gtfs';
import { gtfsManifest } from 'gtfs/schema';
import { openSqliteDatabase } from 'gtfs/sqlite';
import { inspectKyselyGtfsSchema } from 'gtfs/kysely';
import { Kysely, PostgresDialect, MysqlDialect } from 'kysely';
import pg from 'pg';
import Cursor from 'pg-cursor';
import mysql from 'mysql2';
assert.ok(gtfsManifest);
assert.equal(typeof openSqliteDatabase, 'function');
assert.equal(typeof inspectKyselyGtfsSchema, 'function');
const sources = [{ sourceId: 'runtime', schedule: { path: process.argv[2] } }];
const gtfs = new Gtfs({ database: { path: ':memory:' }, sources });
try {
  const result = await gtfs.import();
  assert.equal(result.success, true);
  assert.ok(await gtfs.schedule.routes.count() > 0);
  const exported = await gtfs.export({ sourceId: 'runtime', outputDirectory: 'output' });
  assert.equal(exported.sourceId, 'runtime');
  const controller = new AbortController();
  controller.abort(new Error('runtime cancellation'));
  await assert.rejects(gtfs.import({ signal: controller.signal }), { code: 'GTFS_OPERATION_CANCELLED' });
} finally {
  await gtfs.close();
}
for (const dialect of [
  new PostgresDialect({ pool: new pg.Pool(), cursor: Cursor }),
  new MysqlDialect({ pool: mysql.createPool({}) }),
]) {
  const database = new Kysely({ dialect });
  const borrowed = new Gtfs({ database: { client: database } });
  await borrowed.close();
  await database.destroy();
}
console.log('Installed-package import, ZIP import/export, cancellation and driver setup passed on ' + process.version);
`,
  );
  process.stdout.write(
    run(process.execPath, [
      'smoke.mjs',
      path.join(root, 'test/fixtures/caltrain_20160406.zip'),
    ]),
  );
  const cli = path.join(directory, 'node_modules/gtfs/dist/bin/gtfs.js');
  assert.match(run(process.execPath, [cli, '--help']), /Usage:/i);
  assert.ok(
    run(process.execPath, [cli, '--version']).includes(manifest.version),
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
