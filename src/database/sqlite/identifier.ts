export function quoteSqliteIdentifier(identifier: string): string {
  return identifier
    .split('.')
    .map((part) => (part === '*' ? part : `"${part.replaceAll('"', '""')}"`))
    .join('.');
}
