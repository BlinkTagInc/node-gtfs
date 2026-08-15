import type { LogLevel, LogMessageLevel } from '../types/global_interfaces.ts';

export type TaskName = 'import' | 'export' | 'realtime';

export type ReportEvent =
  | { type: 'message'; level: LogMessageLevel; body: string | Error }
  | {
      type: 'run:start';
      task: TaskName;
      agencyCount: number;
      sqlitePath: string;
    }
  | { type: 'progress'; message: string }
  | { type: 'status'; message: string }
  | {
      type: 'run:complete';
      task: TaskName;
      elapsedSeconds: number;
      destination?: string;
      summary?: string;
    };

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warning: 2,
  info: 3,
};

export function eventLevel(event: ReportEvent): LogMessageLevel {
  return event.type === 'message' ? event.level : 'info';
}

export function allowsLevel(logLevel: LogLevel, level: LogMessageLevel) {
  return LEVEL_SEVERITY[logLevel] >= LEVEL_SEVERITY[level];
}
