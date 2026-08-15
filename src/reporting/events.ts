import type { LogLevel, LogMessageLevel } from '../types/global_interfaces.ts';

/** Which of node-gtfs's long-running operations an event belongs to. */
export type TaskName = 'import' | 'export' | 'realtime';

/*
 * Everything node-gtfs has to say about a run, as data rather than text.
 *
 * The library emits these; a reporter decides what they look like. Keeping the
 * two apart is what lets the same run redraw a status line on a terminal,
 * print milestones when its output is a file, and hand plain messages to a
 * caller's `logFunction` - without any of those choices leaking into the code
 * doing the work.
 */
export type ReportEvent =
  /*
   * Output with no structure beyond its level: a file that could not be
   * parsed, a duplicate primary key, a download that had to be retried. `body`
   * is the error itself where there is one, so a reporter can render the code
   * and category a `GtfsError` carries instead of just its message.
   */
  | { type: 'message'; level: LogMessageLevel; body: string | Error }
  /* A run has started. */
  | {
      type: 'run:start';
      task: TaskName;
      agencyCount: number;
      sqlitePath: string;
    }
  /*
   * A step finished, and the next one will replace this line. Used for the
   * per-file lines of an import or export, where a terminal shows one line
   * that changes rather than one line per file.
   */
  | { type: 'progress'; message: string }
  /* A milestone that keeps its own line. */
  | { type: 'status'; message: string }
  /* A run finished. */
  | {
      type: 'run:complete';
      task: TaskName;
      elapsedSeconds: number;
      /* Where the run put what it produced, when that is a place. */
      destination?: string;
      summary?: string;
    };

/*
 * How much output each `logLevel` allows. An event is reported when its own
 * level is at least as severe as the configured one, so `warning` shows
 * warnings and errors but not progress and status.
 */
const LEVEL_SEVERITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warning: 2,
  info: 3,
};

/*
 * The level an event is reported at. Everything describing the progress of a
 * run is info; warnings and errors arrive as `message` and carry their own.
 */
export function eventLevel(event: ReportEvent): LogMessageLevel {
  return event.type === 'message' ? event.level : 'info';
}

export function allowsLevel(logLevel: LogLevel, level: LogMessageLevel) {
  return LEVEL_SEVERITY[logLevel] >= LEVEL_SEVERITY[level];
}
