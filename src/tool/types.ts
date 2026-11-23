export type Mode = 'int' | 'dec';

export type Separator = 'comma' | 'space' | 'newline';

export interface HistoryEntry {
  /** Short human readable description of the generation. */
  text: string;
  /** The settings snapshot used to generate, JSON string. */
  settings: string;
  /** ISO timestamp when the entry was saved. */
  createdAt: string;
}

export interface ToolState {
  /** Integer or decimal mode. */
  mode: Mode;
  /** Range minimum, as string input. */
  min: string;
  /** Range maximum, as string input. */
  max: string;
  /** How many numbers to generate (1-1000), as string input. */
  count: string;
  /** Decimal places used when mode is 'dec' (0-10), as string input. */
  decimals: string;
  /** Unique-only mode: no duplicates in one draw. */
  unique: boolean;
  /** Last generated numbers. */
  values: number[];
  /** Generation history, newest first. */
  history: HistoryEntry[];
}

export const DEFAULT_STATE: ToolState = {
  mode: 'int',
  min: '1',
  max: '100',
  count: '10',
  decimals: '2',
  unique: false,
  values: [],
  history: [],
};

export const MAX_HISTORY = 20;
export const MAX_COUNT = 1000;
export const MAX_DECIMALS = 10;

/** Parse a plain decimal number; returns null for empty/unparseable input. */
export function parseNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Parse an integer field; returns null unless the value is a whole number. */
export function parseInt(input: string): number | null {
  const value = parseNumber(input);
  if (value === null || !Number.isInteger(value)) return null;
  return value;
}

/** Format a number with the given number of decimal places. */
export function formatNumber(value: number, decimals = 0): string {
  return value.toFixed(Math.max(0, Math.min(MAX_DECIMALS, decimals)));
}

/** Number of decimal places implied by state (dec mode only). */
export function decimalsFor(state: ToolState): number {
  if (state.mode !== 'dec') return 0;
  const d = parseInt(state.decimals);
  if (d === null || d < 0) return 0;
  return Math.min(d, MAX_DECIMALS);
}

export interface Validation {
  valid: boolean;
  error?: string;
  min: number;
  max: number;
  count: number;
  decimals: number;
}

/** Validate all generation inputs; non-mutating. */
export function validateInputs(state: ToolState): Validation {
  const min = parseNumber(state.min);
  const max = parseNumber(state.max);
  const count = parseInt(state.count);
  const decimals = decimalsFor(state);
  if (min === null || max === null) {
    return {
      valid: false,
      error: 'Min and max must be valid numbers.',
      min: 0,
      max: 0,
      count: 0,
      decimals,
    };
  }
  if (min > max) {
    return {
      valid: false,
      error: 'Min must be less than or equal to max.',
      min,
      max,
      count: 0,
      decimals,
    };
  }
  if (count === null || count < 1 || count > MAX_COUNT) {
    return {
      valid: false,
      error: `Count must be an integer between 1 and ${MAX_COUNT}.`,
      min,
      max,
      count: 0,
      decimals,
    };
  }
  if (state.mode === 'dec' && decimals < 1) {
    return {
      valid: false,
      error: 'Decimal mode requires at least 1 decimal place.',
      min,
      max,
      count,
      decimals,
    };
  }
  const rangeSize = state.mode === 'int' ? Math.floor(max) - Math.ceil(min) + 1 : max - min;
  if (state.unique && Number.isFinite(rangeSize) && rangeSize < count) {
    return {
      valid: false,
      error: `Unique mode needs at least ${count} distinct values in the range.`,
      min,
      max,
      count,
      decimals,
    };
  }
  return { valid: true, min, max, count, decimals };
}

export type RandomSource = () => number;

/** Uniform float in [min, max). */
export function randomFloat(min: number, max: number, rng: RandomSource = Math.random): number {
  return min + rng() * (max - min);
}

/** Uniform integer in [min, max] inclusive. */
export function randomInt(min: number, max: number, rng: RandomSource = Math.random): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi === lo) return lo;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Round to n decimal places. */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface GenerateResult {
  values: number[];
  error?: string;
}

/**
 * Generate `count` numbers in [min, max].
 * Integer mode draws uniform integers; decimal mode draws floats rounded to
 * `decimals` places. Unique mode never repeats a value. Uses a Fisher-Yates
 * walk over candidate values when unique, so full-range draws work fast.
 */
export function generate(
  min: number,
  max: number,
  count: number,
  mode: Mode,
  decimals: number,
  unique: boolean,
  rng: RandomSource = Math.random
): GenerateResult {
  if (count < 1 || count > MAX_COUNT) return { values: [], error: 'Invalid count.' };
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    return { values: [], error: 'Invalid range.' };
  }
  if (mode === 'int') {
    if (unique) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      const pool: number[] = [];
      for (let v = lo; v <= hi; v++) pool.push(v);
      if (pool.length < count) return { values: [], error: 'Range too small for unique draw.' };
      // Partial Fisher-Yates: shuffle only what we need.
      for (let i = 0; i < count; i++) {
        const j = i + Math.floor(rng() * (pool.length - i));
        const tmpI = pool[i] as number;
        const tmpJ = pool[j] as number;
        pool[i] = tmpJ;
        pool[j] = tmpI;
      }
      return { values: pool.slice(0, count) };
    }
    const values: number[] = [];
    for (let i = 0; i < count; i++) values.push(randomInt(min, max, rng));
    return { values };
  }
  if (unique) {
    const seen = new Set<number>();
    const values: number[] = [];
    const maxAttempts = count * 200;
    let attempts = 0;
    // Decimal mode with decimals>=1 has a finite set of distinct values per range.
    const distinctEstimate = Math.round((max - min) * 10 ** decimals);
    while (values.length < count && attempts < maxAttempts) {
      attempts++;
      const raw = randomFloat(min, max, rng);
      const value = roundTo(raw, decimals);
      if (seen.has(value)) continue;
      seen.add(value);
      values.push(value);
    }
    if (values.length < count) {
      const cap = Math.max(distinctEstimate, 0);
      return {
        values: [],
        error:
          cap < count
            ? `Only ~${cap} distinct values exist at ${decimals} decimals in this range.`
            : 'Could not draw enough unique values.',
      };
    }
    return { values };
  }
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(roundTo(randomFloat(min, max, rng), decimals));
  }
  return { values };
}

export interface Stats {
  sum: number;
  average: number;
  min: number;
  max: number;
}

/** Sum/average/min/max of a non-empty numeric set. */
export function getStats(values: number[]): Stats | null {
  if (values.length === 0) return null;
  let sum = 0;
  let min = values[0] as number;
  let max = values[0] as number;
  for (const v of values) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { sum, average: sum / values.length, min, max };
}

/** Join values for copy-all with the requested separator. */
export function joinValues(values: number[], decimals: number, separator: Separator): string {
  const sep = separator === 'comma' ? ', ' : separator === 'space' ? ' ' : '\n';
  return values.map((v) => formatNumber(v, decimals)).join(sep);
}

/** Human-readable one-line description of a generation. */
export function resultText(state: ToolState): string | null {
  if (state.values.length === 0) return null;
  const d = decimalsFor(state);
  const preview = state.values.slice(0, 5).map((v) => formatNumber(v, d));
  const rest = state.values.length > 5 ? ` … (+${state.values.length - 5} more)` : '';
  return preview.join(', ') + rest;
}

/** Compact summary used by the status bar and copy actions. */
export function summaryText(state: ToolState): string {
  if (state.values.length === 0) return 'RNG: press Generate';
  return `RNG: ${state.values.length} value${state.values.length === 1 ? '' : 's'} in [${state.min}, ${state.max}]`;
}

export const SEPARATORS: { value: Separator; label: string }[] = [
  { value: 'comma', label: 'Comma' },
  { value: 'space', label: 'Space' },
  { value: 'newline', label: 'Newline' },
];
