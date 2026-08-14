import { errorVerbosity, formatError, formatStackTrace } from './format.ts';

/*
 * The text a command line entry point ends on. An error written to be read by
 * whoever ran the tool is shown as written; anything else escaped from
 * somewhere it shouldn't have, and keeps its stack trace so it can be traced.
 */
export function formatFatalError(error: unknown = 'Unknown Error'): string {
  const lines = [`\n${formatError(error)}`];

  if (errorVerbosity(error) === 'developer') {
    lines.push(formatStackTrace(error));
  }

  return `${lines.join('\n')}\n`;
}

/*
 * Report an error that ended the process, then exit non-zero. Shared by every
 * entry point so that a bad config reads the same however node-gtfs was
 * started, rather than reaching Node's default handler as a stack trace.
 */
export function handleFatalError(error: unknown = 'Unknown Error'): never {
  process.stderr.write(formatFatalError(error));
  process.exit(1);
}
