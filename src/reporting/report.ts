import { allowsLevel, eventLevel } from './events.ts';
import { createReporter } from './reporters.ts';

import type { ReportEvent } from './events.ts';
import type { Reporter } from './reporters.ts';
import type {
  Config,
  LogLevel,
  LogMessageLevel,
} from '../types/global_interfaces.ts';

/*
 * One reporter per config object, which is one per run. The console reporter
 * holds the line its progress is drawn on, so it has to be the same object for
 * the whole run rather than rebuilt at each call site.
 */
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

/*
 * How much to print.
 */
export function getLogLevel(config: Config): LogLevel {
  if (config.logLevel !== undefined) {
    return config.logLevel;
  }

  return config.verbose === false ? 'warning' : 'info';
}

/*
 * Report an event. Everything node-gtfs has to say goes through here: the
 * event is dropped if `config.logLevel` is below its level, and otherwise
 * handed to the reporter chosen for this run.
 */
export function report(config: Config, event: ReportEvent) {
  if (!allowsLevel(getLogLevel(config), eventLevel(event))) {
    return;
  }

  reporterFor(config).report(event);
}

/*
 * Report a message that has nothing structured about it. `body` may be an
 * error, in which case the code and category it carries survive as far as the
 * reporter instead of being flattened to `error.message` at the call site.
 */
export function log(
  config: Config,
  level: LogMessageLevel,
  body: string | Error,
) {
  report(config, { type: 'message', level, body });
}

/* A line the next one replaces on a terminal - the per-file import lines. */
export function progress(config: Config, message: string) {
  report(config, { type: 'progress', message });
}

/* A milestone that keeps its own line. */
export function status(config: Config, message: string) {
  report(config, { type: 'status', message });
}
