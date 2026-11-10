import { stripVTControlCharacters } from 'node:util';

import * as colors from 'yoctocolors';

import type { GtfsReportEvent } from './events.ts';

const segments = new Intl.Segmenter('en', { granularity: 'grapheme' });

function characterWidth(character: string): number {
  if (/^[\p{Mark}\p{Control}\p{Format}]+$/u.test(character)) {
    return 0;
  }
  // CJK characters and emoji occupy two terminal cells.
  if (
    /[\p{Emoji_Presentation}\ufe0f\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff01-\uff60\uffe0-\uffe6\u{20000}-\u{3fffd}]/u.test(
      character,
    )
  ) {
    return 2;
  }
  return 1;
}

export function getTerminalDisplayWidth(text: string): number {
  let width = 0;
  for (const { segment } of segments.segment(stripVTControlCharacters(text))) {
    width += characterWidth(segment);
  }
  return width;
}

function fitLine(text: string, width: number): string {
  const plain = stripVTControlCharacters(text).replace(/\s+/gu, ' ').trim();
  if (getTerminalDisplayWidth(plain) <= width) {
    return plain;
  }
  let result = '';
  let used = 0;
  for (const { segment } of segments.segment(plain)) {
    used += characterWidth(segment);
    if (used > width - 1) {
      break;
    }
    result += segment;
  }
  return `${result}…`;
}

export function formatProgressLines({
  event,
  columns,
  spinnerFrame = '',
  tick = 0,
  completed = false,
}: {
  readonly event: GtfsReportEvent;
  readonly columns: number;
  readonly spinnerFrame?: string;
  readonly tick?: number;
  readonly completed?: boolean;
}): readonly [string, string] {
  // Leave the last cell empty to avoid automatic terminal line wrapping.
  const width = Math.max(1, columns - 1);
  const prefix = completed ? `${colors.green('✔')} ` : `${spinnerFrame} `;
  const title =
    width < 4
      ? fitLine(event.message, width)
      : `${prefix}${fitLine(event.message, width - 2)}`;
  const current = event.type === 'progress' ? event.current : undefined;
  const total = event.type === 'progress' ? event.total : undefined;
  const fraction = completed
    ? 1
    : current !== undefined &&
        Number.isFinite(current) &&
        total !== undefined &&
        Number.isFinite(total) &&
        total > 0
      ? Math.max(0, Math.min(1, current / total))
      : undefined;
  const percentage =
    fraction === undefined ? '' : ` ${(fraction * 100).toFixed(1)}%`;
  const suffix = percentage.length < width ? percentage : '';
  const barWidth = width - suffix.length;
  let bar: string;
  if (fraction === undefined) {
    const blockWidth = Math.max(1, Math.ceil(barWidth / 5));
    const travel = barWidth - blockWidth;
    const position = travel === 0 ? 0 : tick % (travel * 2);
    const offset = position > travel ? travel * 2 - position : position;
    bar =
      ' '.repeat(offset) + '#'.repeat(blockWidth) + ' '.repeat(travel - offset);
  } else {
    const filled = Math.floor(barWidth * fraction);
    bar = '#'.repeat(filled) + ' '.repeat(barWidth - filled);
  }
  return [title, `${bar}${suffix}`];
}
