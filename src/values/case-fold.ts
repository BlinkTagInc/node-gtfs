import { UNICODE_CASE_FOLDING_17 } from '../data/unicode-case-folding-17.ts';

const CASE_FOLD_COLUMN_PREFIX = '_node_gtfs_casefold_';

/** Unicode 17 full default case folding followed by NFC normalization. */
export function foldGtfsText(value: string): string {
  let folded = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    folded += UNICODE_CASE_FOLDING_17[codePoint] ?? character;
  }
  return folded.normalize('NFC');
}

/** Internal binary-collated shadow used by explicit case-insensitive queries. */
export function getCaseFoldColumnName(columnName: string): string {
  return `${CASE_FOLD_COLUMN_PREFIX}${columnName}`;
}
