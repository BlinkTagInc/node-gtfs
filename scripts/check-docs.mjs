import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return markdownFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : [];
  });
}

const files = [
  path.join(root, 'README.md'),
  ...markdownFiles(path.join(root, 'docs')),
];
const jsonSampleFiles = readdirSync(root)
  .filter((filename) => /^config-sample.*\.json$/.test(filename))
  .map((filename) => path.join(root, filename));
const errors = [];
const javascriptBlocks = [];

function checkCodeBlocks(file, contents) {
  const fencePattern = /^```([^\n]*)\n([\s\S]*?)^```\s*$/gm;
  let match;

  while ((match = fencePattern.exec(contents)) !== null) {
    const language = match[1].trim().toLowerCase();
    const code = match[2];
    const line = contents.slice(0, match.index).split('\n').length;

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

function checkLocalLinks(file, contents) {
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  let match;

  while ((match = linkPattern.exec(contents)) !== null) {
    const target = match[1].trim().replace(/^<|>$/g, '');

    if (
      target === '' ||
      target.startsWith('#') ||
      /^[a-z][a-z\d+.-]*:/i.test(target)
    ) {
      continue;
    }

    const decodedTarget = decodeURIComponent(target.split('#')[0]);
    const resolved = path.resolve(path.dirname(file), decodedTarget);

    if (!existsSync(resolved) || !statSync(resolved).isFile()) {
      const line = contents.slice(0, match.index).split('\n').length;
      errors.push(
        `${path.relative(root, file)}:${line}: missing local link target ${target}`,
      );
    }
  }
}

for (const file of files) {
  const contents = readFileSync(file, 'utf8');
  checkCodeBlocks(file, contents);
  checkLocalLinks(file, contents);
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
