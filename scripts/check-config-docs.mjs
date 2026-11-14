/** Verify documented config names against public types and resolve JSON examples. */
import assert from 'node:assert/strict';
import {
  readFileSync,
  readdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { resolveGtfsConfig } from '../src/config/resolver.ts';
import { markdownFiles, parseMarkdown } from './lib/documentation.mjs';

const root = process.cwd();
const reference = readFileSync('docs/reference/configuration.md', 'utf8').split(
  '## Instance operation options',
)[0];
const prefixes = {
  'Schedule input': 'sources[].schedule',
  'Schedule import policy': 'sources[].schedule.import',
  'Archive limits': 'sources[].schedule.import.archive',
  'Validation settings': 'sources[].schedule.import.validation',
  'CSV options': 'sources[].schedule.import.csv',
  'GTFS-Realtime feeds and retention': 'sources[].realtime.feeds[]',
};
const documented = new Set();
let prefix = '';
for (const line of reference.split('\n')) {
  const heading = /^#{2,3} (.+)$/.exec(line);
  if (heading) {
    prefix = prefixes[heading[1]] ?? '';
  }
  const row = /^\|\s*`([a-zA-Z][\w.[\]]*)`\s*\|/.exec(line);
  if (row) {
    const name = prefix ? `${prefix}.${row[1]}` : row[1];
    assert.ok(!documented.has(name), `Duplicate documented option: ${name}`);
    documented.add(name);
  }
}
// Compile a bidirectional equality assertion against the public configuration type.
// Keeping this in TypeScript also supports compilers without a JavaScript API.
const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-config-docs-'));
try {
  const filename = path.join(directory, 'config-paths.mts');
  writeFileSync(
    filename,
    `
    import type { GtfsConfig } from ${JSON.stringify(path.join(root, 'src/types/config.ts'))};
    type Leaf = 'client' | 'reporter' | 'requestHeaders' | 'extensions' | 'excludeFiles';
    type Paths<T> = T extends readonly (infer Item)[]
      ? \`[].\${Paths<Item>}\`
      : T extends object ? {
          [K in keyof T & string]: K | (K extends Leaf ? never :
            NonNullable<T[K]> extends readonly (infer Item)[]
              ? \`\${K}[].\${Paths<Item>}\`
              : \`\${K}.\${Paths<NonNullable<T[K]>>}\`)
        }[keyof T & string] : never;
    type Documented = ${[...documented].map((name) => JSON.stringify(name)).join(' | ')};
    type AssertNever<T extends never> = T;
    type UnknownOptions = AssertNever<Exclude<Documented, Paths<GtfsConfig>>>;
    type MissingOptions = AssertNever<Exclude<Paths<GtfsConfig>, Documented>>;
  `,
  );
  const result = spawnSync(
    path.join(root, 'node_modules/.bin/tsc'),
    [
      '--ignoreConfig',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target',
      'esnext',
      '--module',
      'nodenext',
      '--allowImportingTsExtensions',
      filename,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(
    result.status,
    0,
    `Configuration reference differs from public types:\n${result.stdout}${result.stderr}`,
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}

let examples = 0;
function validate(value, location) {
  // Partial examples are completed only with required context, never by removing keys.
  let input = value;
  if (Object.hasOwn(value, 'feedId')) {
    input = {
      extensions: ['gtfs-realtime'],
      sources: [{ realtime: { feeds: [value] } }],
    };
  }
  if (Object.hasOwn(value, 'path') || Object.hasOwn(value, 'url')) {
    if (!Object.hasOwn(value, 'feedId')) {
      input = { sources: [{ schedule: value }] };
    }
  } else if (Object.hasOwn(value, 'schedule')) {
    input = { sources: [value] };
  }
  input = { database: { path: './transit.sqlite' }, ...input };
  try {
    resolveGtfsConfig(input, {
      format: 'json',
      operation: input.extensions === 'auto' ? 'import' : 'instance',
    });
  } catch (error) {
    throw new Error(`${location}: invalid documented configuration`, {
      cause: error,
    });
  }
  examples += 1;
}
for (const filename of ['README.md', ...markdownFiles('docs')]) {
  for (const block of parseMarkdown(readFileSync(filename, 'utf8'))
    .codeBlocks) {
    if (block.language === 'json' && !block.options.includes('legacy')) {
      validate(JSON.parse(block.code), `${filename}:${block.line}`);
    }
  }
}
for (const filename of readdirSync(root).filter((name) =>
  /^config-sample.*\.json$/.test(name),
)) {
  validate(JSON.parse(readFileSync(filename, 'utf8')), filename);
}
console.log(
  `Verified ${documented.size} configuration paths and ${examples} JSON configurations.`,
);
