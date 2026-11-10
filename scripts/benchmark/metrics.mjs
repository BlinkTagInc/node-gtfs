/** Shared measurement and correctness helpers for the SQLite benchmark workers. */
import { createHash } from 'node:crypto';

export function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) {
    throw new Error('Cannot summarize an empty sample');
  }
  const percentile = (fraction) =>
    sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  return {
    samples: sorted.length,
    median,
    min: sorted[0],
    max: sorted.at(-1),
    p25: percentile(0.25),
    p75: percentile(0.75),
    p95: percentile(0.95),
  };
}

export function canonicalValue(
  value,
  field = {},
  { storedMoney = false, currency } = {},
) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (field.kind === 'time') {
    const parts = String(value).split(':').map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
      throw new Error(`Invalid benchmark time ${JSON.stringify(value)}`);
    }
    return String(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }
  if (field.monetary && storedMoney) {
    const digits = new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits;
    const units = String(value);
    const negative = units.startsWith('-');
    const padded = (negative ? units.slice(1) : units).padStart(
      digits + 1,
      '0',
    );
    value = `${negative ? '-' : ''}${digits ? `${padded.slice(0, -digits)}.${padded.slice(-digits)}` : padded}`;
  }
  if (field.monetary) {
    const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(
      String(value),
    );
    if (!match) {
      throw new Error('Invalid monetary benchmark value');
    }
    const [, sign, whole, fraction = '', exponent = '0'] = match;
    const scale = fraction.length - Number(exponent);
    let digits = `${whole}${fraction}`.replace(/^0+/, '') || '0';
    let decimal;
    if (scale <= 0) {
      decimal = digits + '0'.repeat(-scale);
    } else {
      digits = digits.padStart(scale + 1, '0');
      decimal = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(
        /\.?0+$/,
        '',
      );
    }
    return `${sign === '-' && decimal !== '0' ? '-' : ''}${decimal}`;
  }
  if (field.kind === 'real') {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error('Non-finite benchmark value');
    }
    return String(number);
  }
  if (field.kind === 'integer' || field.kind === 'date') {
    return BigInt(value).toString();
  }
  return String(value);
}

// A count plus modular sum of SHA-256 row hashes is order-independent and
// preserves duplicate multiplicity without retaining millions of rows.
export function createDigest() {
  let count = 0;
  let sum = 0n;
  const mask = (1n << 256n) - 1n;
  return {
    add(value) {
      const hex = createHash('sha256')
        .update(JSON.stringify(value))
        .digest('hex');
      sum = (sum + BigInt(`0x${hex}`)) & mask;
      count += 1;
    },
    result() {
      return { count, sha256Sum: sum.toString(16).padStart(64, '0') };
    },
  };
}

export function digestRows(rows, fields) {
  const digest = createDigest();
  for (const row of rows) {
    digest.add(fields.map((field) => canonicalValue(row[field])));
  }
  return digest.result();
}

export async function measure(operation) {
  const cpu = process.cpuUsage();
  const start = performance.now();
  const value = await operation();
  const durationMs = performance.now() - start;
  const used = process.cpuUsage(cpu);
  const memory = process.memoryUsage();
  return {
    value,
    metrics: {
      durationMs,
      cpuUserMs: used.user / 1000,
      cpuSystemMs: used.system / 1000,
      processPeakRssBytes: process.resourceUsage().maxRSS * 1024,
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
    },
  };
}
