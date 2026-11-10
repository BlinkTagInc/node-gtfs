/**
 * Checks published Markdown and configuration samples for broken links, invalid
 * fenced examples, and stale package references. Called by `pnpm docs:check`
 * locally and in CI.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { markdownFiles, parseMarkdown } from './lib/documentation.mjs';

const root = process.cwd();

const files = [
  ...readdirSync(root)
    .filter((filename) => filename.endsWith('.md'))
    .map((filename) => path.join(root, filename)),
  ...markdownFiles(path.join(root, 'docs')),
];
const jsonSampleFiles = readdirSync(root)
  .filter((filename) => /^config-sample.*\.json$/.test(filename))
  .map((filename) => path.join(root, filename));
const errors = [];
const javascriptBlocks = [];
const documents = new Map();

function readDocument(file) {
  if (!documents.has(file)) {
    documents.set(file, parseMarkdown(readFileSync(file, 'utf8')));
  }
  return documents.get(file);
}

function checkCodeBlocks(file, blocks) {
  for (const { language, code, line } of blocks) {
    if (language === 'json') {
      try {
        JSON.parse(code);
      } catch (error) {
        errors.push(
          `${path.relative(root, file)}:${line}: invalid JSON: ${error.message}`,
        );
      }
    }

    if (['js', 'javascript', 'mjs'].includes(language)) {
      javascriptBlocks.push({
        code,
        location: `${path.relative(root, file)}:${line}`,
      });
    }
  }
}

function checkJavaScriptBlocks() {
  const checker = `
    import { readFileSync } from 'node:fs';
    import { SourceTextModule } from 'node:vm';

    const blocks = JSON.parse(readFileSync(0, 'utf8'));
    const failures = [];

    for (const block of blocks) {
      try {
        new SourceTextModule(block.code, { identifier: block.location });
      } catch (error) {
        failures.push({ location: block.location, message: error.message });
      }
    }

    process.stdout.write(JSON.stringify(failures));
  `;
  const result = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', '--input-type=module', '--eval', checker],
    {
      input: JSON.stringify(javascriptBlocks),
      encoding: 'utf8',
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    },
  );

  if (result.status !== 0) {
    errors.push(`Unable to check JavaScript examples: ${result.stderr.trim()}`);
    return;
  }

  for (const failure of JSON.parse(result.stdout)) {
    errors.push(`${failure.location}: invalid JavaScript: ${failure.message}`);
  }
}

function checkLocalLinks(file, links) {
  for (const { target, line } of links) {
    if (
      target === '' ||
      target.startsWith('//') ||
      /^[a-z][a-z\d+.-]*:/i.test(target)
    ) {
      continue;
    }

    let resolved;
    let anchor;
    try {
      const url = new URL(target, pathToFileURL(file));
      resolved = fileURLToPath(url);
      anchor = decodeURIComponent(url.hash.slice(1));
    } catch {
      errors.push(
        `${path.relative(root, file)}:${line}: invalid local link ${target}`,
      );
      continue;
    }

    if (!existsSync(resolved) || !statSync(resolved).isFile()) {
      errors.push(
        `${path.relative(root, file)}:${line}: missing local link target ${target}`,
      );
    } else if (
      anchor &&
      path.extname(resolved) === '.md' &&
      !readDocument(resolved).anchors.has(anchor)
    ) {
      errors.push(
        `${path.relative(root, file)}:${line}: missing heading anchor ${target}`,
      );
    }
  }
}

for (const file of files) {
  const { codeBlocks, links } = readDocument(file);
  checkCodeBlocks(file, codeBlocks);
  checkLocalLinks(file, links);
}

for (const file of jsonSampleFiles) {
  try {
    JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${path.relative(root, file)}: invalid JSON: ${error.message}`);
  }
}

checkJavaScriptBlocks();

if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Checked ${files.length} Markdown files and ${jsonSampleFiles.length} JSON sample files.\n`,
  );
}
