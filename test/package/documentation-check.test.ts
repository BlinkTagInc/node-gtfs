import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

async function fixture(t: TestContext) {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-doc-check-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'docs'));
  return directory;
}

function check(script: string, directory: string, args: string[] = []) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts', script), ...args],
    {
      cwd: directory,
      encoding: 'utf8',
      timeout: 10_000,
    },
  );
  assert.equal(result.error, undefined);
  return result;
}

test('documentation links resolve rendered headings, duplicate slugs, references, and encoded paths', async (t) => {
  const directory = await fixture(t);
  await writeFile(
    path.join(directory, 'README.md'),
    [
      '# Guide',
      '[Formatted](docs/field%20guide.md#use-stop_id--routes "title")',
      '[Duplicate](docs/field%20guide.md#repeat-1)',
      '[Collision](docs/field%20guide.md#repeat-1-1)',
      '[Unicode][unicode]',
      '[Setext](docs/field%20guide.md#twolines)',
      '[Explicit](docs/field%20guide.md#custom-anchor)',
      '[Named](docs/field%20guide.md#legacy-anchor)',
      '[Local](#guide)',
      '[External](https://example.test/#not-checked)',
      '[Protocol relative](//example.test/file.md#not-checked)',
      '[unicode]: docs/field%20guide.md#caf%C3%A9-%E4%BD%A0%E5%A5%BD',
      '```text',
      '# Fake heading',
      '[Not a link](does-not-exist.md#fake)',
      '```',
    ].join('\n'),
  );
  await writeFile(
    path.join(directory, 'docs/field guide.md'),
    [
      '# Use `stop_id` & **routes**',
      '## Repeat',
      '## Repeat',
      '## Repeat-1',
      '## [Café](https://example.test/) 你好',
      'Two',
      'lines',
      '-----',
      '<a id="custom-anchor"></a>',
      '<a name="legacy-anchor"></a>',
    ].join('\n'),
  );
  const result = check('check-docs.mjs', directory);
  assert.equal(result.status, 0, result.stderr);
});

test('documentation checks reject missing files and anchors without accepting code or comments as headings', async (t) => {
  const directory = await fixture(t);
  await writeFile(
    path.join(directory, 'README.md'),
    [
      '# Guide',
      '[Missing file](missing.md)',
      '[Missing same-page heading](#missing)',
      '[Reference][bad]',
      '[Code heading](#fake)',
      '[Comment anchor](#comment-anchor)',
      '[Encoded missing heading](#not%20here)',
      '```text',
      '# Fake',
      '```',
      '<!-- <a id="comment-anchor"></a> -->',
      '[bad]: docs/other.md#renamed-heading',
    ].join('\n'),
  );
  await writeFile(
    path.join(directory, 'docs/other.md'),
    '# Existing heading\n',
  );
  const result = check('check-docs.mjs', directory);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /README\.md:2: missing local link target missing\.md/,
  );
  for (const target of [
    '#missing',
    'docs/other.md#renamed-heading',
    '#fake',
    '#comment-anchor',
    '#not%20here',
  ]) {
    assert.ok(
      result.stderr.includes(`missing heading anchor ${target}`),
      result.stderr,
    );
  }
});

test('published examples retain shared setup, preserve source locations, and explicitly exclude historical code', async (t) => {
  const directory = await fixture(t);
  const output = path.join(directory, 'examples');
  await writeFile(
    path.join(directory, 'README.md'),
    [
      '# Examples',
      '```js setup',
      'const sourceId = "metro";',
      '```',
      '~~~js',
      'await gtfs.schedule.routes.where({ source_id: sourceId }).all();',
      '~~~',
      '```js legacy',
      'legacyExample();',
      '```',
      '```ts',
      'const source: string = sourceId;',
      '```',
    ].join('\n'),
  );
  await writeFile(
    path.join(directory, 'docs/other.md'),
    '```js\nawait gtfs.close();\n```\n',
  );
  const result = check('extract-doc-examples.mjs', directory, [
    '--examples-directory',
    output,
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /Extracted 4 current examples; skipped 1 explicitly marked legacy/,
  );
  assert.deepEqual((await readdir(output)).sort(), [
    'documentation-README-L11.mts',
    'documentation-README-L2.mjs',
    'documentation-README-L5.mjs',
    'documentation-context.d.ts',
    'documentation-docs-other-L1.mjs',
  ]);
  assert.equal(
    await readFile(path.join(output, 'documentation-README-L5.mjs'), 'utf8'),
    '// README.md:5\nconst sourceId = "metro";\nawait gtfs.schedule.routes.where({ source_id: sourceId }).all();\n',
  );
  assert.equal(
    await readFile(
      path.join(output, 'documentation-docs-other-L1.mjs'),
      'utf8',
    ),
    '// docs/other.md:1\nawait gtfs.close();\n',
  );
  await writeFile(
    path.join(directory, 'README.md'),
    '```js legcay\nunknownExample();\n```\n',
  );
  const invalid = check('extract-doc-examples.mjs', directory, [
    '--examples-directory',
    output,
  ]);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /README\.md:1: unknown example option/);
});
