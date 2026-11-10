import * as colors from 'yoctocolors';

import { formatError, formatWarning } from './format.ts';
import { formatProgressLines } from './console-progress.ts';
import { createConsoleAnimation } from './console-animation.ts';
import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../diagnostics/errors.ts';
import { assertConfigOptionKeys } from '../config/options.ts';

import type { GtfsReportEvent } from './events.ts';
import type { GtfsReporter } from './types.ts';

export interface GtfsConsoleReporterOptions {
  /** Diagnostic destination. Defaults to process.stderr. */
  readonly stream?: NodeJS.WritableStream;
  /** Animate progress in place. Defaults to true only for a TTY stream. */
  readonly animateProgress?: boolean;
}

function formatInformationalEvent(event: GtfsReportEvent): string {
  if (
    (event.type === 'progress' || event.type === 'status') &&
    event.progressBar === false &&
    !(
      event.type === 'status' &&
      event.phase === 'start' &&
      event.heading === true
    )
  ) {
    return event.type === 'status' && event.phase === 'complete'
      ? `${colors.green('✔')} ${event.message}`
      : event.message;
  }
  if (event.type === 'status' && event.heading === false) {
    return event.message;
  }
  if (event.type === 'status' && event.phase === undefined) {
    return `Info: ${event.message}`;
  }
  const completed =
    event.type === 'operation:complete' ||
    (event.type === 'status' && event.phase === 'complete');
  const prefix = completed
    ? `${colors.green('✔')}   `
    : `${colors.blue('==>')} `;
  const continuationIndent = ' '.repeat(4);
  const [firstLine = '', ...remainingLines] = event.message.split('\n');

  return [
    `${prefix}${completed ? firstLine.trimStart() : colors.bold(firstLine.trimStart())}`,
    ...remainingLines.map((line) => `${continuationIndent}${line}`),
    ...(event.type === 'status' && event.databaseDescription !== undefined
      ? [`Using ${event.databaseDescription}`]
      : []),
    ...(event.type === 'operation:complete' &&
    event.databaseDescription !== undefined
      ? [event.databaseDescription]
      : []),
  ].join('\n');
}

export function createConsoleReporter(
  options: GtfsConsoleReporterOptions = {},
): GtfsReporter {
  assertConfigOptionKeys(options, {
    name: 'createConsoleReporter()',
    keys: ['stream', 'animateProgress'],
  });
  if (
    options.animateProgress !== undefined &&
    typeof options.animateProgress !== 'boolean'
  ) {
    throw new GtfsError(
      'The `createConsoleReporter()` option `animateProgress` must be a boolean',
      {
        code: GtfsErrorCode.CONFIG_INVALID,
        category: GtfsErrorCategory.CONFIG,
      },
    );
  }
  const stream = options.stream ?? process.stderr;
  const animateProgress =
    options.animateProgress ??
    (stream as NodeJS.WritableStream & { isTTY?: boolean }).isTTY === true;
  const animation = createConsoleAnimation(stream);

  return (event: GtfsReportEvent) => {
    if (event.type === 'operation:start' && event.operation === 'import') {
      return;
    }
    const isActiveStatus = event.type === 'status' && event.phase === 'start';
    if (
      animateProgress &&
      event.level === 'info' &&
      (event.type === 'progress' || isActiveStatus)
    ) {
      if (isActiveStatus) {
        if (
          event.filename === undefined &&
          event.heading !== false &&
          (event.progressBar !== false || event.heading === true)
        ) {
          animation.writeLine(formatInformationalEvent(event));
        } else {
          animation.stop();
        }
      }
      animation.animate(({ columns, spinnerFrame, tick }) =>
        formatProgressLines({ event, columns, spinnerFrame, tick }).slice(
          0,
          (event.type === 'status' || event.type === 'progress') &&
            event.progressBar === false
            ? 1
            : 2,
        ),
      );
      return;
    }

    if (event.level === 'error') {
      animation.writeLine(formatError(event.message));
    } else if (event.level === 'warn') {
      animation.writeLine(formatWarning(event.message));
    } else if (
      animateProgress &&
      event.type === 'status' &&
      event.progressBar !== false &&
      event.phase === 'complete'
    ) {
      animation.writeLine(
        formatProgressLines({
          event,
          columns: animation.getColumns(),
          completed: true,
        }).join('\n'),
      );
    } else {
      animation.writeLine(formatInformationalEvent(event));
    }
  };
}
