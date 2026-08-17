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
  LogFunction,
  LogMessageLevel,
  ReportingOptions,
} from './types.ts';

export interface Reporter {
  report(event: ReportEvent): void;
}

function createConsoleReporter(animate: boolean): Reporter {
  let lineHeld = false;

  const drawProgress = (message: string) => {
    if (!animate) {
      return;
    }

    clearLine(process.stdout, 0);
    cursorTo(process.stdout, 0);
    process.stdout.write(message);
    lineHeld = true;
  };

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

export function createReporter(config: ReportingOptions): Reporter {
  if (config.logFunction) {
    return createLogFunctionReporter(config.logFunction);
  }

  return createConsoleReporter(process.stdout.isTTY === true);
}
