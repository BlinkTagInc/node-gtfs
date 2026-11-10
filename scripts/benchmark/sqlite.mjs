/**
 * Orchestrates isolated v4/v5 SQLite benchmarks; run via pnpm benchmark:sqlite.
 * Preparation, builds, correctness hashing, and CSV verification are untimed.
 */
import assert from 'node:assert/strict';
import { createHash, randomInt } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { cpus, totalmem, platform, release, homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import { parse } from 'csv-parse';
import { extractZipArchive } from '../../src/io/zip.ts';
import { gtfsManifest } from '../../src/schema/manifest.ts';

import { summarize } from './metrics.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const { values } = parseArgs({
  options: {
    'v4-root': {
      type: 'string',
      default: path.join(root, 'internal/benchmarks/v4'),
    },
    feed: { type: 'string', multiple: true },
    repetitions: { type: 'string', default: '3' },
    warmups: { type: 'string', default: '1' },
    profiles: { type: 'string', default: 'defaults,controlled-safe' },
    validation: { type: 'string', default: 'off' },
    'query-repetitions': { type: 'string', default: '10' },
    'query-warmups': { type: 'string', default: '2' },
    'worker-timeout-ms': { type: 'string', default: '900000' },
    output: { type: 'string', default: path.join(root, 'internal/benchmarks') },
    'keep-databases': { type: 'boolean', default: false },
    'import-only': { type: 'boolean', default: false },
    diagnostics: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(
    'node scripts/benchmark/sqlite.mjs --feed /path/to/feed.zip [--feed another.zip] [--repetitions 3] [--warmups 1] [--profiles defaults,controlled-safe,controlled-unsafe] [--validation off|strict|permissive] [--import-only] [--diagnostics] [--worker-timeout-ms 900000] [--keep-databases]',
  );
  process.exit(0);
}
const baselineRoot = path.resolve(values['v4-root']);
const baselineManifest = JSON.parse(
  await readFile(
    path.join(import.meta.dirname, 'baseline/package.json'),
    'utf8',
  ),
);
const baselineLock = JSON.parse(
  await readFile(path.join(baselineRoot, 'package-lock.json'), 'utf8'),
);
assert.equal(
  baselineLock.packages[''].dependencies.gtfs,
  baselineManifest.dependencies.gtfs,
  'Baseline lock must use the configured v4 package version',
);
const v4PackageRoot = path.join(baselineRoot, 'node_modules/gtfs');
const installedBaseline = JSON.parse(
  await readFile(path.join(v4PackageRoot, 'package.json'), 'utf8'),
);
assert.equal(
  installedBaseline.version,
  baselineManifest.dependencies.gtfs,
  'Installed baseline must use the configured v4 package version',
);
const { gtfsManifest: v4Manifest } = await import(
  pathToFileURL(path.join(v4PackageRoot, 'dist/schema/index.js')).href
);

const integer = (key, minimum) => {
  const number = Number(values[key]);
  assert.ok(
    Number.isSafeInteger(number) && number >= minimum,
    `Invalid --${key}`,
  );
  return number;
};
const repetitions = integer('repetitions', 1);
const warmups = integer('warmups', 0);
const queryRepetitions = integer('query-repetitions', 1);
const queryWarmups = integer('query-warmups', 0);
const workerTimeoutMs = integer('worker-timeout-ms', 1);
const profiles = [...new Set(values.profiles.split(','))];
const validationMode = values.validation;
assert.ok(
  ['off', 'strict', 'permissive'].includes(validationMode),
  'Invalid --validation',
);
assert.ok(
  profiles.every((profile) =>
    ['defaults', 'controlled-safe', 'controlled-unsafe'].includes(profile),
  ),
);
const outputRoot = path.resolve(values.output);
await mkdir(outputRoot, { recursive: true });
const output = await mkdtemp(path.join(outputRoot, 'sqlite-'));
await cp(
  path.join(baselineRoot, 'package-lock.json'),
  path.join(output, 'baseline-package-lock.json'),
);
console.log(`Results: ${output}`);
const packageInfo = JSON.parse(
  await readFile(path.join(root, 'package.json'), 'utf8'),
);

async function sha256(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

async function inventoryTree(directory, prefix = '') {
  const files = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      Object.assign(
        files,
        await inventoryTree(path.join(directory, entry.name), relative),
      );
    } else if (entry.isFile()) {
      files[relative] = await sha256(path.join(directory, entry.name));
    }
  }
  return files;
}

await cp(path.join(root, 'dist'), path.join(output, 'dist'), {
  recursive: true,
});
await cp(path.join(root, 'src'), path.join(output, 'src'), { recursive: true });
await cp(import.meta.dirname, path.join(output, 'harness'), {
  recursive: true,
});
await writeFile(
  path.join(output, 'change.patch'),
  execFileSync('git', ['diff', 'HEAD'], { cwd: root }),
);

async function findFeed(directory) {
  const found = [];
  async function visit(folder) {
    const entries = await readdir(folder, { withFileTypes: true });
    if (
      entries.some((entry) => entry.name === 'agency.txt' && entry.isFile())
    ) {
      found.push(folder);
    }
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== '__MACOSX') {
        await visit(path.join(folder, entry.name));
      }
    }
  }
  await visit(directory);
  assert.equal(
    found.length,
    1,
    'Expected one feed directory containing agency.txt',
  );
  return found[0];
}

async function prepareFeed(filename, index) {
  const directory = path.join(output, `feed-${index}`);
  const archiveChecksum = await sha256(filename);
  await extractZipArchive(filename, directory);
  const feedDirectory = await findFeed(directory);
  const tables = [];
  const probe = {};
  const inventory = [];
  for (const entry of await readdir(feedDirectory, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    const fullPath = path.join(feedDirectory, entry.name);
    const info = await stat(fullPath);
    inventory.push({
      filename: entry.name,
      bytes: info.size,
      sha256: await sha256(fullPath),
    });
    const table = Object.values(gtfsManifest).find(
      (candidate) => candidate.filename === entry.name,
    );
    if (
      !table ||
      table.specification !== 'gtfs-schedule' ||
      !entry.name.endsWith('.txt')
    ) {
      continue;
    }
    const old = Object.values(v4Manifest).find(
      (candidate) => candidate.file === entry.name,
    );
    if (!old) {
      continue;
    }
    let recordCount = 0;
    let fields;
    const parser = parse({
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    const input = createReadStream(fullPath);
    input.on('error', (error) => parser.destroy(error));
    input.pipe(parser);
    try {
      for await (const row of parser) {
        recordCount += 1;
        fields ??= Object.fromEntries(
          Object.keys(row)
            .filter((name) => table.fields[name] && old.fields[name])
            .map((name) => [name, table.fields[name]]),
        );
        if (entry.name === 'trips.txt' && !probe.tripId) {
          probe.tripId = row.trip_id;
          probe.routeId = row.route_id;
          probe.serviceId = row.service_id;
        }
        if (entry.name === 'calendar.txt' && !probe.serviceDate) {
          probe.serviceDate = Number(row.start_date);
        }
        if (entry.name === 'calendar_dates.txt' && row.exception_type === '1') {
          probe.exceptionDate ??= Number(row.date);
        }
      }
    } finally {
      input.destroy();
      parser.destroy();
    }
    if (recordCount > 0) {
      tables.push({
        filename: entry.name,
        tableName: table.tableName,
        fields,
        recordCount,
      });
    }
  }
  probe.serviceDate ??= probe.exceptionDate;
  assert.ok(
    probe.tripId && probe.routeId && probe.serviceDate,
    'Feed needs trips and a service date for query probes',
  );
  return {
    filename,
    archiveChecksum,
    archiveBytes: (await stat(filename)).size,
    directory: feedDirectory,
    inventory,
    tables,
    probe,
  };
}

function runWorker(jobPath, job) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const child = spawn(
      process.execPath,
      [
        ...(job.diagnostics && job.version === 'v5' && job.action === 'import'
          ? [
              '--cpu-prof',
              `--cpu-prof-dir=${output}`,
              `--cpu-prof-name=${path.basename(path.dirname(jobPath))}.cpuprofile`,
            ]
          : []),
        '--disable-warning=ExperimentalWarning',
        path.join(output, 'harness/worker.mjs'),
        jobPath,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          NODE_OPTIONS: '',
          GTFS_TEST_POSTGRES_URL: '',
          GTFS_TEST_MYSQL_URL: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, workerTimeoutMs);
    const heartbeat = setInterval(
      () =>
        console.log(
          `  working (${Math.round((performance.now() - started) / 1000)}s)`,
        ),
      30000,
    );
    child.once('error', (error) => {
      clearTimeout(timeout);
      clearInterval(heartbeat);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      clearInterval(heartbeat);
      if (code !== 0) {
        reject(
          new Error(
            `${job.version} ${job.workload}: ${timedOut ? `worker exceeded ${workerTimeoutMs} ms` : `worker failed (${code ?? signal})`}: ${stderr}\n${stdout}`,
          ),
        );
        return;
      }
      try {
        resolve({
          ...JSON.parse(stdout),
          processWallMs: performance.now() - started,
        });
      } catch (error) {
        reject(
          new Error(`Invalid benchmark worker output: ${stdout}\n${stderr}`, {
            cause: error,
          }),
        );
      }
    });
  });
}

const report = {
  formatVersion: 1,
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: platform(),
    osRelease: release(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    memoryBytes: totalmem(),
    gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    worktreeStatus: execFileSync('git', ['status', '--short'], {
      cwd: root,
      encoding: 'utf8',
    }),
    v4LockSha256: await sha256(path.join(baselineRoot, 'package-lock.json')),
    v5Build: await inventoryTree(path.join(output, 'dist')),
    v5Source: await inventoryTree(path.join(output, 'src')),
    harness: await inventoryTree(path.join(output, 'harness')),
    v5LockSha256: await sha256(path.join(root, 'pnpm-lock.yaml')),
    v4Build: await inventoryTree(path.join(v4PackageRoot, 'dist')),
  },
  settings: {
    repetitions,
    warmups,
    queryRepetitions,
    queryWarmups,
    workerTimeoutMs,
    profiles,
    validationMode,
    order: 'randomized sequential version pairs',
    importOnly: values['import-only'],
    diagnostics: values.diagnostics,
  },
  notes: [
    'Local feed copies only; download, extraction, checksums, installation, build, and correctness scans are untimed.',
    'Cold means a fresh process/connection, not a flushed operating-system disk cache.',
    'Peak RSS is process-wide through the timed operation, including startup; correctness scans occur afterward.',
    'Default v4 creates all registered tables and imports recognized extension files; default v5 enables core Schedule only.',
    `V5 Schedule validation is explicitly ${validationMode}; v4 uses its released import behavior. V5 normalization and database constraints remain active.`,
    'Controlled profiles use matching cache/temp/foreign-key settings. controlled-unsafe uses journal OFF and synchronous OFF during import; v5 restores its safe settings afterward.',
    'Count and pagination use materialized v4 getters followed by length/slice because v4 has no equivalent getter methods.',
    'tripsStream fully consumes the v5 async iterator into the same projected array as the v4 getter; this measures terminal overhead, not bounded-memory streaming. Large and early stream evidence is recorded separately.',
    'Import/export equality checks shared source-present fields, excluding unknown/generated fields. Monetary comparisons use canonical decimal strings without rounding through floating point.',
    'This harness does not yet measure incremental second-source imports, Realtime, standalone schema/index phases, optional-extension cohorts, mixed arrival/departure windows, or GeoJSON.',
  ],
  feeds: [],
  samples: [],
  comparisons: [],
  failures: [],
};

async function saveReport() {
  await writeFile(
    path.join(output, 'results.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const lines = [
    '# SQLite v4/v5 benchmark',
    '',
    `Run: ${report.generatedAt}. Node ${report.environment.node}. CPU: ${report.environment.cpu}.`,
    '',
    `V5 validation: **${validationMode}**. ${repetitions} measured repetitions after ${warmups} import warmup(s) per version/profile.`,
    '',
    'Ratios below 1 favor v5. No ratio is reported unless all compared results match.',
    '',
    '| Feed | Profile | Workload | v4 median ms (min–max) | v5 median ms (min–max) | v5/v4 | Correctness |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  if (repetitions < 3) {
    lines.splice(
      4,
      0,
      'Exploratory run: fewer than three measured repetitions. Do not treat these timings as a stable baseline.',
      '',
    );
  }
  for (const row of report.comparisons) {
    const show = (stats) =>
      `${stats.median.toFixed(2)} (${stats.min.toFixed(2)}–${stats.max.toFixed(2)})`;
    lines.push(
      `| ${row.feed} | ${row.profile} | ${row.workload} | ${show(row.v4)} | ${show(row.v5)} | ${row.ratio === null ? '—' : row.ratio.toFixed(2)} | ${row.equivalent ? 'matched' : 'MISMATCH'} |`,
    );
  }
  lines.push(
    '',
    '## Scope and interpretation',
    '',
    ...report.notes.map((note) => `- ${note}`),
    '',
    'Machine-readable results include every sample, CPU and memory measurements, database/sidecar sizes, actual SQLite versions and pragma transitions, feed checksums, and validation notices.',
    '',
  );
  if (report.failures.length > 0) {
    lines.push(
      '## Failures',
      '',
      ...report.failures.map((failure) => `- ${failure}`),
      '',
    );
  }
  if (values.diagnostics) {
    lines.push(
      'Diagnostic run: v5 CPU profiling and phase tracing were enabled. Timings are instrumented; ratios are intentionally omitted.',
      '',
    );
  }
  await writeFile(path.join(output, 'summary.md'), lines.join('\n'));
}

try {
  const filenames = values.feed ?? [
    path.join(root, 'test/fixtures/caltrain_20160406.zip'),
  ];
  for (const [feedIndex, rawFilename] of filenames.entries()) {
    const filename = path.resolve(rawFilename.replace(/^~(?=\/|$)/, homedir()));
    console.log(`Preparing ${path.basename(filename)}`);
    const feed = await prepareFeed(filename, feedIndex);
    report.feeds.push(feed);
    const planPath = path.join(output, `plan-${feedIndex}.json`);
    await writeFile(planPath, JSON.stringify(feed));
    console.log(
      `${feed.tables.reduce((count, table) => count + table.recordCount, 0).toLocaleString()} shared Schedule records`,
    );
    for (const profile of profiles) {
      for (let round = -warmups; round < repetitions; round += 1) {
        const versions = randomInt(2) === 0 ? ['v4', 'v5'] : ['v5', 'v4'];
        for (const version of versions) {
          const work = await mkdtemp(path.join(output, 'work-'));
          const base = {
            version,
            v4PackageRoot,
            currentPackageRoot: root,
            apiPath:
              version === 'v5' ? path.join(output, 'dist/index.js') : undefined,
            profile,
            planPath,
            databasePath: path.join(work, 'transit.sqlite'),
            expectedPackageVersion: packageInfo.version,
            outputDirectory: path.join(work, 'export'),
            extensions: [],
            validationMode,
            queryRepetitions,
            queryWarmups,
            diagnostics: values.diagnostics,
          };
          const scenarios = [{ action: 'import', workload: 'import' }];
          if (
            !values['import-only'] &&
            round >= 0 &&
            profile === 'controlled-safe'
          ) {
            scenarios.push(
              { action: 'export', workload: 'export' },
              ...[
                'tripLookup',
                'tripsByRoute',
                'tripCount',
                'tripPage',
                'stopTimesByTrip',
                'stopsByRoute',
                'tripsStream',
              ].map((query) => ({ action: 'query', query, workload: query })),
            );
          }
          try {
            for (const scenario of scenarios) {
              console.log(
                `${path.basename(filename)} ${profile} ${round < 0 ? 'warmup' : `run ${round + 1}`} ${version} ${scenario.workload}`,
              );
              const jobPath = path.join(work, 'job.json');
              const job = { ...base, ...scenario };
              await writeFile(jobPath, JSON.stringify(job));
              await writeFile(
                path.join(
                  output,
                  `${feedIndex}-${profile}-${round}-${version}-${scenario.workload}.job.json`,
                ),
                JSON.stringify(job),
              );
              const sample = await runWorker(jobPath, job);
              report.samples.push({
                ...sample,
                feedIndex,
                round,
                workload: scenario.workload,
              });
              console.log(
                `  ${sample.metrics.durationMs.toFixed(1)} ms; ${(sample.metrics.processPeakRssBytes / 1048576).toFixed(1)} MiB peak RSS`,
              );
              await saveReport();
            }
          } finally {
            if (!values['keep-databases']) {
              await rm(work, { recursive: true, force: true });
            }
          }
        }
      }
      const samples = report.samples.filter(
        (sample) =>
          sample.feedIndex === feedIndex &&
          sample.profile === profile &&
          sample.round >= 0,
      );
      for (const workload of new Set(
        samples.map((sample) => sample.workload),
      )) {
        const selected = samples.filter(
          (sample) => sample.workload === workload,
        );
        const v4 = selected.filter((sample) => sample.version === 'v4');
        const v5 = selected.filter((sample) => sample.version === 'v5');
        const reference = v4[0]?.evidence;
        const importEvidence = samples.find(
          (sample) => sample.version === 'v4' && sample.workload === 'import',
        )?.evidence;
        const equivalent =
          selected.every((sample) =>
            isDeepStrictEqual(sample.evidence, reference),
          ) &&
          (workload !== 'export' ||
            isDeepStrictEqual(reference, importEvidence));
        assert.equal(v4.length, repetitions);
        assert.equal(v5.length, repetitions);
        const v4Stats = summarize(
          v4.map((sample) => sample.metrics.durationMs),
        );
        const v5Stats = summarize(
          v5.map((sample) => sample.metrics.durationMs),
        );
        report.comparisons.push({
          feed: path.basename(filename),
          feedIndex,
          profile,
          workload,
          equivalent,
          v4: v4Stats,
          v5: v5Stats,
          resources: Object.fromEntries(
            [
              ['v4', v4],
              ['v5', v5],
            ].map(([version, samples]) => [
              version,
              {
                peakRssBytes: summarize(
                  samples.map((sample) => sample.metrics.processPeakRssBytes),
                ),
                closedDatabaseBytes: summarize(
                  samples.map((sample) => sample.afterCloseBytes.database),
                ),
              },
            ]),
          ),
          ratio:
            equivalent && !values.diagnostics
              ? v5Stats.median / v4Stats.median
              : null,
        });
        if (!equivalent) {
          process.exitCode = 1;
        }
      }
      await saveReport();
    }
  }
} catch (error) {
  report.failures.push(error.stack ?? String(error));
  process.exitCode = 1;
} finally {
  await saveReport();
  console.log(`Report: ${path.join(output, 'summary.md')}`);
}
