/** Output threshold for a run. */
export type LogLevel = 'silent' | 'error' | 'warning' | 'info';

export type LogMessageLevel = Exclude<LogLevel, 'silent'>;

/** Receives non-progress log messages. */
export type LogFunction = (level: LogMessageLevel, message: string) => void;

export interface ReportingOptions {
  /**
   * Whether to print progress output.
   *
   * @deprecated Use `logLevel`. `false` maps to `warning`.
   */
  verbose?: boolean;
  /** How much to print. Defaults to `info`. */
  logLevel?: LogLevel;
  /** Optional destination for non-progress log messages. */
  logFunction?: LogFunction;
}
