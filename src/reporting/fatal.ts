import { errorVerbosity, formatError, formatStackTrace } from './format.ts';

export function formatFatalError(error: unknown = 'Unknown Error'): string {
  const lines = [`\n${formatError(error)}`];

  if (errorVerbosity(error) === 'developer') {
    lines.push(formatStackTrace(error));
  }

  return `${lines.join('\n')}\n`;
}

export function handleFatalError(error: unknown = 'Unknown Error'): never {
  process.stderr.write(formatFatalError(error));
  process.exit(1);
}
