import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { stripVTControlCharacters } from 'node:util';

import { createConsoleReporter } from '../../src/reporting/reporters.ts';
import {
  formatProgressLines,
  getTerminalDisplayWidth,
} from '../../src/reporting/console-progress.ts';
import type { GtfsReportEvent } from '../../src/reporting/events.ts';

import { stripColors } from '../helpers/console-output.ts';

const envelope = {
  level: 'info',
  timestampMs: 0,
  operationId: 'console-test',
} as const;
const progress: GtfsReportEvent = {
  ...envelope,
  type: 'progress',
  message: 'Importing stop_times.txt',
  current: 25,
  total: 100,
};

test('renders two lines with a proportional bar across terminal widths', () => {
  for (const columns of [1, 2, 4, 20, 80, 160]) {
    const lines = formatProgressLines({
      event: progress,
      columns,
      spinnerFrame: '⠲',
    });
    assert.equal(lines.length, 2);
    assert.ok(
      lines.every(
        (line) => getTerminalDisplayWidth(line) <= Math.max(1, columns - 1),
      ),
    );
    assert.equal(getTerminalDisplayWidth(lines[1]), Math.max(1, columns - 1));
    if (columns >= 20) {
      assert.match(lines[1], / 25\.0%$/u);
      assert.equal(
        lines[1].match(/#/gu)?.length,
        Math.floor((columns - 7) / 4),
      );
    }
  }
});

test('keeps Unicode, multiline labels, and completed rows within two lines', () => {
  assert.equal(getTerminalDisplayWidth('✔ 東京 🚆 e\u0301'), 11);
  for (const completed of [false, true]) {
    const lines = formatProgressLines({
      event: {
        ...progress,
        message: '東京 🚆 e\u0301 '.repeat(40) + '\nsecond line',
      },
      columns: 32,
      spinnerFrame: '⠲',
      completed,
    });
    assert.equal(lines.join('\n').split('\n').length, 2);
    assert.ok(lines.every((line) => getTerminalDisplayWidth(line) <= 31));
    assert.match(lines[0], /…$/u);
    if (completed) {
      assert.match(stripVTControlCharacters(lines[0]), /^✔ /u);
      assert.match(lines[1], /^#+ 100\.0%$/u);
    }
  }
});

test('unknown totals animate without inventing a percentage and invalid values are bounded', () => {
  const unknown = { ...progress, total: 0 };
  const first = formatProgressLines({
    event: unknown,
    columns: 80,
    spinnerFrame: '⠋',
    tick: 0,
  });
  const next = formatProgressLines({
    event: unknown,
    columns: 80,
    spinnerFrame: '⠙',
    tick: 1,
  });
  assert.notEqual(first[1], next[1]);
  assert.ok(!first[1].includes('%'));
  for (const [current, suffix] of [
    [-10, '0.0%'],
    [200, '100.0%'],
  ] as const) {
    assert.ok(
      formatProgressLines({
        event: { ...progress, current },
        columns: 80,
        spinnerFrame: '⠲',
      })[1].endsWith(suffix),
    );
  }
  assert.ok(
    !formatProgressLines({
      event: { ...progress, total: NaN },
      columns: 80,
      spinnerFrame: '⠲',
    })[1].includes('%'),
  );
});

test('redraws both rows on resize and stops before errors or completion', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const stream = Object.assign(new PassThrough(), { isTTY: true, columns: 80 });
  let output = '';
  stream.on('data', (chunk) => {
    output += chunk.toString();
  });
  const reporter = createConsoleReporter({ stream });
  reporter(progress);
  output = '';
  stream.columns = 40;
  t.mock.timers.tick(80);
  assert.ok(output.includes('\u001b[2A\u001b[0J'));
  const resized = output.split('\u001b[0J').at(-1)!.split('\n');
  assert.equal(resized.length, 2);
  assert.equal(getTerminalDisplayWidth(resized[1]!), 39);
  reporter({
    ...envelope,
    type: 'message',
    level: 'error',
    message: 'Download failed',
  });
  assert.ok(stripColors(output).endsWith('Error: Download failed\n'));
  const stopped = output;
  t.mock.timers.tick(1000);
  assert.equal(output, stopped);
  reporter(progress);
  reporter({
    ...envelope,
    type: 'status',
    phase: 'complete',
    message: 'Imported stop_times.txt',
  });
  assert.match(
    stripColors(output),
    /✔ Imported stop_times\.txt\n#+ 100\.0%\n$/u,
  );
  const completed = output;
  t.mock.timers.tick(1000);
  assert.equal(output, completed);
  stream.end();
});

test('redirected diagnostics have no cursor movement or timers', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const stream = new PassThrough();
  let output = '';
  stream.on('data', (chunk) => {
    output += chunk.toString();
  });
  const reporter = createConsoleReporter({ stream });
  reporter(progress);
  assert.equal(stripColors(output), '==> Importing stop_times.txt\n');
  t.mock.timers.tick(1000);
  assert.equal(stripColors(output), '==> Importing stop_times.txt\n');
  reporter({
    ...envelope,
    type: 'status',
    phase: 'start',
    heading: false,
    message: 'Replacing existing schedule data for source "default"',
  });
  assert.ok(
    stripColors(output).endsWith(
      '\nReplacing existing schedule data for source "default"\n',
    ),
  );
  stream.end();
});

test('preparation uses one animated line and clears it before completing', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const stream = Object.assign(new PassThrough(), { isTTY: true, columns: 80 });
  let output = '';
  stream.on('data', (chunk) => {
    output += chunk.toString();
  });
  const reporter = createConsoleReporter({ stream });
  reporter({
    ...envelope,
    type: 'progress',
    progressBar: false,
    current: 512,
    message: 'stops.txt — 512 rows processed',
  });
  assert.match(output, /^⠋ stops.txt — 512 rows processed$/u);
  output = '';
  t.mock.timers.tick(80);
  assert.ok(output.includes('⠙ stops.txt — 512 rows processed'));
  assert.ok(!output.includes('\n'));
  reporter({
    ...envelope,
    type: 'status',
    phase: 'complete',
    progressBar: false,
    message: 'stops.txt — 1,200 rows',
  });
  assert.ok(stripColors(output).endsWith('✔ stops.txt — 1,200 rows\n'));
  assert.doesNotMatch(output, /#|100\.0%/u);
  const completed = output;
  t.mock.timers.tick(1000);
  assert.equal(output, completed);
  reporter(progress);
  assert.ok(output.includes('\n'));
  reporter({
    ...envelope,
    type: 'message',
    level: 'error',
    message: 'Stopped',
  });
  stream.end();
});

test('colors only the arrow and error prefix, and makes the task heading bold', () => {
  const script = `
    import { createConsoleReporter } from './src/reporting/reporters.ts';
    const reporter = createConsoleReporter({ animateProgress: false });
    const base = { level: 'info', timestampMs: 0, operationId: 'color-test' };
    reporter({ ...base, type: 'status', phase: 'start', operation: 'import', message: 'Importing GTFS' });
    reporter({ ...base, type: 'status', phase: 'start', heading: true, progressBar: false, message: 'Deleting existing schedule data' });
    reporter({ ...base, type: 'message', level: 'error', message: 'Unable to read feed' });
  `;
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        FORCE_COLOR: '1',
        NODE_DISABLE_COLORS: '',
        NO_COLOR: '',
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    result.stderr.includes(
      '\u001b[34m==>\u001b[39m \u001b[1mImporting GTFS\u001b[22m\n',
    ),
  );
  assert.ok(
    result.stderr.includes(
      '\u001b[34m==>\u001b[39m \u001b[1mDeleting existing schedule data\u001b[22m\n',
    ),
  );
  assert.ok(
    result.stderr.includes('\u001b[31mError:\u001b[39m Unable to read feed\n'),
  );
});
