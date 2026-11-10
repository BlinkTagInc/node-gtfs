export function stripColors(output: string): string {
  // Strip only SGR styling so cursor-control regressions remain visible.
  // eslint-disable-next-line no-control-regex
  return output.replace(/\u001b\[[\d;]*m/gu, '');
}
