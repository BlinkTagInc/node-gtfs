import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { loadCliConfigFile } from '../../src/cli/config-file.ts';
import { applyCliConfigOverrides } from '../../src/cli/config-overrides.ts';
import { parseFlags } from '../../src/cli/options.ts';
import { GtfsError, formatGtfsError } from '../../src/diagnostics/errors.ts';
import { log } from '../../src/reporting/report.ts';
import { version } from '../../src/version.ts';

for (const { filename, content, code, causeName } of [
  {
    filename: 'missing.json',
    content: undefined,
    code: 'GTFS_CONFIG_FILE_NOT_FOUND',
    causeName: 'Error',
  },
  {
    filename: 'invalid.json',
    content: '{',
    code: 'GTFS_CONFIG_PARSE_FAILED',
    causeName: 'SyntaxError',
  },
] as const) {
  test(`CLI config producer preserves details for ${code}`, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-cli-error-'));
    try {
      if (content !== undefined) {
        await writeFile(path.join(directory, filename), content);
      }
      await assert.rejects(
        loadCliConfigFile({
          cliArguments: { config: filename },
          workingDirectory: directory,
        }),
        (error: unknown) => {
          assert.ok(error instanceof GtfsError);
          assert.equal(error.code, code);
          assert.equal(error.category, 'config');
          assert.deepEqual(error.details, { filePath: filename });
          assert.ok(error.cause instanceof Error);
          assert.equal(error.cause.name, causeName);
          assert.ok(error.message.includes(filename));
          return true;
        },
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test('loadCliConfigFile discovers and parses config.json', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-cli-config-'));
  const expected = {
    database: { path: 'gtfs.sqlite' },
  };

  try {
    await writeFile(
      path.join(directory, 'config.json'),
      JSON.stringify(expected),
    );

    assert.deepEqual(
      await loadCliConfigFile({
        cliArguments: {},
        workingDirectory: directory,
      }),
      expected,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('malformed default configuration reports its real path without echoing contents', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-cli-private-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'config.json'), 'secr3t');
  await assert.rejects(
    loadCliConfigFile({ cliArguments: {}, workingDirectory: directory }),
    (error: unknown) => {
      assert.ok(error instanceof GtfsError);
      assert.equal(error.code, 'GTFS_CONFIG_PARSE_FAILED');
      assert.deepEqual(error.details, { filePath: 'config.json' });
      assert.ok(error.cause instanceof SyntaxError);
      for (const audience of ['user', 'developer'] as const) {
        const formatted = formatGtfsError(error, { audience });
        assert.match(formatted, /config\.json/);
        assert.doesNotMatch(formatted, /secr3t|bin\/config/);
      }
      const events: unknown[] = [];
      log({ reporter: (event) => events.push(event) }, 'error', error);
      assert.equal(events.length, 1);
      assert.doesNotMatch(JSON.stringify(events), /secr3t/);
      return true;
    },
  );
});

test('CLI argument errors keep credentials out of messages and reported details', () => {
  const url =
    'https://user:private-password@example.test/feed?token=private-token';
  for (const invoke of [
    () =>
      parseFlags({
        command: 'gtfs import',
        summary: '',
        flags: [],
        args: [url],
      }),
    () =>
      parseFlags({
        command: 'gtfs import',
        summary: '',
        flags: [],
        args: ['--unknown', url],
      }),
    () =>
      applyCliConfigOverrides({
        config: {},
        operation: 'import',
        cliArguments: { input: 'feed.zip', url },
      }),
  ]) {
    assert.throws(invoke, (error: unknown) => {
      assert.ok(error instanceof GtfsError);
      assert.equal(error.code, 'GTFS_CONFIG_INVALID');
      assert.doesNotMatch(
        formatGtfsError(error, { audience: 'developer' }),
        /private-password|private-token/,
      );
      assert.doesNotMatch(
        JSON.stringify(error.details),
        /private-password|private-token/,
      );
      return true;
    });
  }
});

test('loadCliConfigFile permits direct CLI configuration without a file', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-cli-config-'));

  try {
    assert.deepEqual(
      await loadCliConfigFile({
        cliArguments: { input: 'feed.zip' },
        workingDirectory: directory,
      }),
      {},
    );

    await assert.rejects(
      loadCliConfigFile({ cliArguments: {}, workingDirectory: directory }),
      (error: unknown) => {
        assert.equal(
          (error as { code?: string }).code,
          'GTFS_CONFIG_FILE_NOT_FOUND',
        );
        return true;
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('applyCliConfigOverrides applies import flags without mutating file config', () => {
  const input = {
    database: { path: 'configured.sqlite' },
    reporting: { level: 'info', reporter: 'configured' },
    sources: [{ sourceId: 'configured' }],
  };

  const result = applyCliConfigOverrides({
    config: input,
    cliArguments: {
      database: 'override.sqlite',
      input: 'feed.zip',
      'log-level': 'silent',
      'source-id': 'override',
    },
    operation: 'import',
  });

  assert.deepEqual(result, {
    database: { path: 'override.sqlite' },
    reporting: { level: 'silent', reporter: 'configured' },
    sources: [
      {
        sourceId: 'override',
        schedule: { path: 'feed.zip' },
      },
    ],
  });
  assert.deepEqual(input.sources, [{ sourceId: 'configured' }]);
});

test('applyCliConfigOverrides merges export flags into export config', () => {
  assert.deepEqual(
    applyCliConfigOverrides({
      config: { export: { format: 'csv' } },
      cliArguments: {
        output: 'exported',
        'source-id': 'agency',
      },
      operation: 'export',
    }),
    {
      export: {
        format: 'csv',
        outputDirectory: 'exported',
        sourceId: 'agency',
      },
    },
  );
});

test('import rejects --source-id without direct input regardless of configured sources', () => {
  for (const config of [
    {},
    { sources: [{ schedule: { path: 'feed.zip' } }] },
    { sources: [{ sourceId: 'configured', schedule: { path: 'feed.zip' } }] },
    {
      sources: [
        { sourceId: 'configured', schedule: { path: 'first.zip' } },
        {
          sourceId: 'second',
          schedule: { url: 'https://example.test/feed.zip' },
        },
      ],
    },
  ]) {
    const original = structuredClone(config);
    for (const sourceId of ['configured', 'new-identity']) {
      assert.throws(
        () =>
          applyCliConfigOverrides({
            config,
            cliArguments: { 'source-id': sourceId },
            operation: 'import',
          }),
        {
          code: 'GTFS_CONFIG_INVALID',
          category: 'config',
          details: {
            command: 'gtfs import',
            flag: 'source-id',
            reason: 'requires-direct-input',
            requiredFlags: ['input', 'url'],
            configPath: 'sources[].sourceId',
          },
        },
      );
      assert.deepEqual(config, original);
    }
    assert.deepEqual(
      applyCliConfigOverrides({
        config,
        cliArguments: {},
        operation: 'import',
      }),
      original,
    );
  }
});

test('direct input and URL imports use only the direct source identity, including its default', () => {
  const config = {
    sources: [
      { sourceId: 'first', schedule: { path: 'configured.zip' } },
      { sourceId: 'second', schedule: { path: 'other.zip' } },
    ],
  };
  const original = structuredClone(config);
  for (const { cliArguments, schedule } of [
    { cliArguments: { input: 'direct.zip' }, schedule: { path: 'direct.zip' } },
    {
      cliArguments: { url: 'https://example.test/direct.zip' },
      schedule: { url: 'https://example.test/direct.zip' },
    },
  ]) {
    for (const sourceId of [undefined, 'direct']) {
      const result = applyCliConfigOverrides({
        config,
        cliArguments: {
          ...cliArguments,
          ...(sourceId === undefined ? {} : { 'source-id': sourceId }),
        },
        operation: 'import',
      });
      assert.deepEqual(result.sources, [
        { sourceId: sourceId ?? 'default', schedule },
      ]);
      assert.deepEqual(config, original);
    }
  }
});

test('common help and version aliases render identical output and exit', (t) => {
  const exited = new Error('Intercepted process.exit');
  const output: string[] = [];
  t.mock.method(process.stdout, 'write', (chunk: string | Uint8Array) => {
    output.push(String(chunk));
    return true;
  });
  const exit = t.mock.method(process, 'exit', (code?: number) => {
    assert.ok(code === undefined || code === 0);
    throw exited;
  });
  const render = (args: string[]) => {
    output.length = 0;
    assert.throws(
      () =>
        parseFlags({
          command: 'gtfs',
          summary: 'Transit data',
          flags: [],
          commands: [{ name: 'import', summary: 'Import a feed' }],
          args,
        }),
      (error) => error === exited,
    );
    return output.join('');
  };
  const help = render(['--help']);
  assert.match(help, /^Usage: gtfs <command> \[options\]/);
  assert.match(help, /import\s+Import a feed/);
  assert.equal(render(['-h']), help);
  assert.equal(render([]), help);
  assert.equal(render(['--version']), `${version}\n`);
  assert.equal(render(['-v']), `${version}\n`);
  assert.equal(exit.mock.callCount(), 5);
});
