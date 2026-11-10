import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { markdownFiles, parseMarkdown } from './lib/documentation.mjs';

const { values } = parseArgs({
  options: {
    'package-directory': { type: 'string', default: process.cwd() },
    'examples-directory': { type: 'string' },
  },
});
assert.ok(values['examples-directory'], '--examples-directory is required');
const root = path.resolve(values['package-directory']);
const directory = path.resolve(values['examples-directory']);
await mkdir(directory, { recursive: true });
let count = 0;
let legacy = 0;
const outputs = new Set();
for (const filename of [
  path.join(root, 'README.md'),
  ...markdownFiles(path.join(root, 'docs')),
]) {
  const { codeBlocks } = parseMarkdown(await readFile(filename, 'utf8'));
  const name = path
    .relative(root, filename)
    .replace(/\.md$/, '')
    .replaceAll(path.sep, '-');
  let setup = '';
  for (const { language, code, line, options } of codeBlocks) {
    const javascript = ['js', 'javascript', 'mjs'].includes(language);
    if (!javascript && !['ts', 'typescript', 'mts'].includes(language)) {
      continue;
    }
    assert.ok(
      options.every((option) => ['legacy', 'setup'].includes(option)),
      `${filename}:${line}: unknown example option`,
    );
    if (options.includes('legacy')) {
      legacy += 1;
      continue;
    }
    const output = path.join(
      directory,
      `documentation-${name}-L${line}.${javascript ? 'mjs' : 'mts'}`,
    );
    assert.ok(!outputs.has(output), `Duplicate example filename: ${output}`);
    outputs.add(output);
    await writeFile(
      output,
      `// ${path.relative(root, filename)}:${line}\n${setup}${code}`,
    );
    if (options.includes('setup')) {
      setup += code;
    }
    count += 1;
  }
}
await writeFile(
  path.join(directory, 'documentation-context.d.ts'),
  "declare const gtfs: import('gtfs').Gtfs;\n",
);
assert.ok(count > 0, 'Published code examples are missing');
console.log(
  `Extracted ${count} current examples; skipped ${legacy} explicitly marked legacy examples`,
);
