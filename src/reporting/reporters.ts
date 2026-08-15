import { clearLine, cursorTo } from 'node:readline';

import {
  formatError,
  formatErrorMessage,
  formatRunComplete,
  formatRunStart,
  formatWarning,
} from './format.ts';

import type { ReportEvent } from './events.ts';
import type {
  Config,
  LogFunction,
  LogMessageLevel,
} from '../types/global_interfaces.ts';

/*
 * Somewhere a run can be watched. Every reporter sees the same events; what
 * differs is what it does with them.
 */
export interface Reporter {
  report(event: ReportEvent): void;
}

/*
 * The console reporter.
 *
 * A `progress` event is a line that is still being written - a file part way
 * through importing. It redraws in place so the count climbs without filling
 * the screen, and the next thing printed replaces it. A `status` event is a
 * result, so it keeps its line: every file that finished stays on screen.
 *
 * `animate` is off when nothing is watching, and then transient lines are
 * dropped entirely rather than written out - a log otherwise collects one line
 * per batch of every file.
 *
 * Warnings and errors go to stderr, so `gtfs-import > import.log` captures the
 * run without swallowing its failures.
 */
function createConsoleReporter(animate: boolean): Reporter {
  let lineHeld = false;

  /* The progress line holds the line it is on so the next one can replace it. */
  const drawProgress = (message: string) => {
    if (!animate) {
      return;
    }

    clearLine(process.stdout, 0);
    cursorTo(process.stdout, 0);
    process.stdout.write(message);
    lineHeld = true;
  };

  /*
   * A line that stays. Anything still being drawn is cleared first, so a
   * finished file replaces its own progress line rather than printing beneath
   * a stale copy of itself.
   */
  const writeLine = (
    text: string,
    stream: NodeJS.WritableStream = process.stdout,
  ) => {
    if (lineHeld) {
      clearLine(process.stdout, 0);
      cursorTo(process.stdout, 0);
      lineHeld = false;
    }

    stream.write(`${text}\n`);
  };

  /* A warning or an error as the console shows it: labeled and colored. */
  const writeMessage = (level: LogMessageLevel, body: string | Error) => {
    const text = typeof body === 'string' ? body : formatErrorMessage(body);

    if (level === 'error') {
      writeLine(formatError(body), process.stderr);
    } else if (level === 'warning') {
      writeLine(formatWarning(text), process.stderr);
    } else {
      writeLine(text);
    }
  };

  return {
    report(event: ReportEvent) {
      switch (event.type) {
        case 'message':
          writeMessage(event.level, event.body);
          break;

        case 'run:start':
          writeLine(formatRunStart(event));
          break;

        case 'progress':
          drawProgress(event.message);
          break;

        case 'status':
          writeLine(event.message);
          break;

        case 'run:complete':
          writeLine(formatRunComplete(event));
          break;
      }
    },
  };
}

/*
 * Hands each event to a caller's `logFunction` as a level and a message.
 *
 * The progress line is the one thing that doesn't survive the trip: it is a
 * single line redrawn in place, so it would arrive as one near-identical
 * message per file. Everything it was wrapped around - the run starting, its
 * warnings, its failures, the counts at the end - still does.
 */
function createLogFunctionReporter(logFunction: LogFunction): Reporter {
  return {
    report(event: ReportEvent) {
      switch (event.type) {
        case 'message':
          logFunction(
            event.level,
            typeof event.body === 'string'
              ? event.body
              : formatErrorMessage(event.body),
          );
          break;

        case 'run:start':
          logFunction('info', formatRunStart(event));
          break;

        case 'progress':
          break;

        case 'status':
          logFunction('info', event.message);
          break;

        case 'run:complete':
          logFunction('info', formatRunComplete(event));
          break;
      }
    },
  };
}

/*
 * Pick a reporter for a run: a caller's `logFunction` if there is one,
 * otherwise the console, animated only when something is there to watch it.
 */
export function createReporter(config: Config): Reporter {
  if (config.logFunction) {
    return createLogFunctionReporter(config.logFunction);
  }

  return createConsoleReporter(process.stdout.isTTY === true);
}
