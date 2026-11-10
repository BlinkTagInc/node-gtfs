/**
 * Regenerates the pinned Unicode case-folding and ISO 4217 minor-unit tables
 * from downloaded upstream source files. Run manually with both source-file
 * paths when either pinned dataset is intentionally updated.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const [caseFoldingPath, iso4217Path] = process.argv.slice(2);

if (!caseFoldingPath || !iso4217Path) {
  throw new Error(
    'Usage: node scripts/generate-portable-value-data.mjs <CaseFolding.txt> <list-one.xml>',
  );
}

const [caseFoldingSource, iso4217Source] = await Promise.all([
  readFile(caseFoldingPath, 'utf8'),
  readFile(iso4217Path, 'utf8'),
]);

const caseFolding = new Map();
for (const line of caseFoldingSource.split(/\r?\n/)) {
  const match = line.match(
    /^([0-9A-F]+);\s+([CF]);\s+([0-9A-F ]+);(?:\s+#.*)?$/,
  );
  if (!match) {
    continue;
  }
  const source = Number.parseInt(match[1], 16);
  const replacement = match[3]
    .trim()
    .split(/\s+/)
    .map((codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
    .join('');
  caseFolding.set(source, replacement);
}

const isoPublication = iso4217Source.match(/<ISO_4217\s+Pblshd="([^"]+)"/)?.[1];
if (!isoPublication) {
  throw new Error('Unable to read ISO 4217 publication date');
}

const minorUnits = new Map();
for (const entry of iso4217Source.matchAll(/<CcyNtry>([\s\S]*?)<\/CcyNtry>/g)) {
  const currency = entry[1].match(/<Ccy>([A-Z]{3})<\/Ccy>/)?.[1];
  const exponent = entry[1].match(/<CcyMnrUnts>(\d+)<\/CcyMnrUnts>/)?.[1];
  if (!currency || exponent === undefined) {
    continue;
  }
  const previous = minorUnits.get(currency);
  if (previous !== undefined && previous !== Number(exponent)) {
    throw new Error(`Conflicting minor units for ${currency}`);
  }
  minorUnits.set(currency, Number(exponent));
}

const generatedDirectory = path.resolve('src/data');
const quoteTypeScriptString = (value) =>
  `'${JSON.stringify(value).slice(1, -1).replaceAll("'", "\\'")}'`;
const caseFoldingEntries = [...caseFolding]
  .sort(([left], [right]) => left - right)
  .map(
    ([codePoint, replacement]) =>
      `  0x${codePoint.toString(16).toUpperCase()}: ${quoteTypeScriptString(replacement)},`,
  )
  .join('\n');
const minorUnitEntries = [...minorUnits]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([currency, exponent]) => `  ${currency}: ${exponent},`)
  .join('\n');

await Promise.all([
  writeFile(
    path.join(generatedDirectory, 'unicode-case-folding-17.ts'),
    `/** Generated from Unicode 17.0 CaseFolding.txt (https://www.unicode.org/Public/17.0.0/ucd/CaseFolding.txt); do not edit manually. */\nexport const UNICODE_CASE_FOLDING_17: Readonly<Record<number, string>> = {\n${caseFoldingEntries}\n};\n`,
  ),
  writeFile(
    path.join(generatedDirectory, 'iso-4217-minor-units.ts'),
    `/** Generated from ISO 4217 list one published ${isoPublication} (https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html); do not edit manually. */\nexport const ISO_4217_MINOR_UNITS: Readonly<Record<string, number>> = {\n${minorUnitEntries}\n};\n`,
  ),
]);

execFileSync(
  path.resolve('node_modules/.bin/prettier'),
  ['--write', generatedDirectory],
  { stdio: 'inherit' },
);
