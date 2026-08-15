import { allowsLevel, eventLevel } from './events.ts';
import { createReporter } from './reporters.ts';

import type { ReportEvent } from './events.ts';
import type { Reporter } from './reporters.ts';
import type {
  Config,
  LogLevel,
  LogMessageLevel,
} from '../types/global_interfaces.ts';

// Console reporters retain live-line state for the duration of a run.
const reporters = new WeakMap<Config, Reporter>();

function reporterFor(config: Config) {
  const existing = reporters.get(config);

  if (existing) {
    return existing;
  }

  const reporter = createReporter(config);
  reporters.set(config, reporter);
  return reporter;
}

export function getLogLevel(config: Config): LogLevel {
  if (config.logLevel !== undefined) {
    return config.logLevel;
  }

  return config.verbose === false ? 'warning' : 'info';
}

export function report(config: Config, event: ReportEvent) {
  if (!allowsLevel(getLogLevel(config), eventLevel(event))) {
    return;
  }

  reporterFor(config).report(event);
}

export function log(
  config: Config,
  level: LogMessageLevel,
  body: string | Error,
) {
  report(config, { type: 'message', level, body });
}

export function progress(config: Config, message: string) {
  report(config, { type: 'progress', message });
}

export function status(config: Config, message: string) {
  report(config, { type: 'status', message });
}
