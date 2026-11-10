import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';

import { createConsoleAnimation } from '../../src/reporting/console-animation.ts';

test('animation throttles updates, renders the latest callback, and restarts after stopping', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
  const stream = Object.assign(new PassThrough(), { columns: 80 });
  const animation = createConsoleAnimation(stream);
  t.after(() => {
    animation.stop();
    stream.end();
  });
  let output = '';
  stream.on('data', (chunk) => {
    output += chunk.toString();
  });
  animation.animate(({ columns, spinnerFrame, tick }) => [
    `${spinnerFrame} first ${columns} ${tick}`,
  ]);
  assert.equal(output, '⠋ first 80 0');
  animation.animate(() => ['superseded']);
  animation.animate(({ spinnerFrame, tick }) => [
    `${spinnerFrame} latest ${tick}`,
  ]);
  t.mock.timers.tick(79);
  assert.equal(output, '⠋ first 80 0');
  t.mock.timers.tick(1);
  assert.ok(output.endsWith('⠙ latest 1'));
  assert.ok(!output.includes('superseded'));
  const stopped = output;
  animation.stop();
  t.mock.timers.tick(1000);
  assert.equal(output, stopped);
  animation.animate(({ spinnerFrame, tick }) => [
    `${spinnerFrame} restarted ${tick}`,
  ]);
  assert.ok(output.endsWith('⠹ restarted 2'));
  animation.writeLine('Finished');
  assert.ok(output.endsWith('\u001b[0JFinished\n'));
  const finished = output;
  t.mock.timers.tick(1000);
  assert.equal(output, finished);
  animation.writeLine('Next');
  assert.equal(output, `${finished}Next\n`);
});

test('animation clears wrapped Unicode rows using the current terminal width', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const stream = Object.assign(new PassThrough(), { columns: 10 });
  const animation = createConsoleAnimation(stream);
  t.after(() => {
    animation.stop();
    stream.end();
  });
  let output = '';
  stream.on('data', (chunk) => {
    output += chunk.toString();
  });
  animation.animate(() => ['東京🚆', '123456789']);
  output = '';
  stream.columns = 3;
  t.mock.timers.tick(80);
  assert.equal(output, '\u001b[1G\u001b[4A\u001b[0J東京🚆\n123456789');
  output = '';
  animation.writeLine('Done');
  assert.equal(output, '\u001b[1G\u001b[4A\u001b[0JDone\n');
});

test('animation normalizes terminal widths and plain writes do not start timers', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const stream = Object.assign(new PassThrough(), {
    columns: undefined as number | undefined,
  });
  const animation = createConsoleAnimation(stream);
  t.after(() => stream.end());
  let output = '';
  stream.on('data', (chunk) => {
    output += chunk.toString();
  });
  for (const columns of [undefined, NaN, Infinity, 0, -1]) {
    stream.columns = columns;
    assert.equal(animation.getColumns(), 80);
  }
  stream.columns = 23.5;
  assert.equal(animation.getColumns(), 23);
  stream.columns = 1;
  assert.equal(animation.getColumns(), 1);
  animation.writeLine('Plain');
  t.mock.timers.tick(1000);
  assert.equal(output, 'Plain\n');
});
