import { describe, it, expect } from 'vitest';
import {
  parseNumber,
  parseInt,
  formatNumber,
  decimalsFor,
  validateInputs,
  randomInt,
  randomFloat,
  generate,
  getStats,
  joinValues,
  resultText,
  DEFAULT_STATE,
  MAX_COUNT,
  type ToolState,
  type RandomSource,
} from '@/tool/types';
import {
  deserializeState,
  serializeState,
  withHistory,
  roundTrips,
  summaryText,
} from '@/tool/tool-definition';
import { randomNumberGeneratorTool } from '@/tool/tool-definition';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

/** Deterministic pseudo-random source from a numeric seed (xorshift-ish). */
function seeded(seed: number): RandomSource {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

describe('parseNumber', () => {
  it('parses integers, decimals, signs and exponents', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber('-3.5')).toBe(-3.5);
    expect(parseNumber('+0.25')).toBeCloseTo(0.25);
    expect(parseNumber('.5')).toBeCloseTo(0.5);
    expect(parseNumber('5.')).toBeCloseTo(5);
    expect(parseNumber('1e3')).toBe(1000);
  });

  it('rejects invalid input', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('  ')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('12,5')).toBeNull();
    expect(parseNumber('1.2.3')).toBeNull();
    expect(parseNumber('--5')).toBeNull();
  });
});

describe('parseInt', () => {
  it('accepts whole numbers only', () => {
    expect(parseInt('7')).toBe(7);
    expect(parseInt('-7')).toBe(-7);
    expect(parseInt('7.5')).toBeNull();
    expect(parseInt('abc')).toBeNull();
    expect(parseInt('')).toBeNull();
  });
});

describe('formatNumber / decimalsFor', () => {
  it('formats with the requested decimal places', () => {
    expect(formatNumber(3.14159, 2)).toBe('3.14');
    expect(formatNumber(3.14159, 4)).toBe('3.1416');
    expect(formatNumber(5, 0)).toBe('5');
  });

  it('decimalsFor returns 0 in int mode and clamps in dec mode', () => {
    expect(decimalsFor(state({ mode: 'int', decimals: '5' }))).toBe(0);
    expect(decimalsFor(state({ mode: 'dec', decimals: '3' }))).toBe(3);
    expect(decimalsFor(state({ mode: 'dec', decimals: '50' }))).toBe(10);
    expect(decimalsFor(state({ mode: 'dec', decimals: '-2' }))).toBe(0);
  });
});

describe('validateInputs', () => {
  it('accepts a valid default state', () => {
    const v = validateInputs(DEFAULT_STATE);
    expect(v.valid).toBe(true);
    expect(v.min).toBe(1);
    expect(v.max).toBe(100);
    expect(v.count).toBe(10);
  });

  it('rejects min > max', () => {
    expect(validateInputs(state({ min: '50', max: '10' })).valid).toBe(false);
  });

  it('rejects non-numeric range', () => {
    expect(validateInputs(state({ min: 'abc' })).valid).toBe(false);
  });

  it('rejects count out of 1..1000', () => {
    expect(validateInputs(state({ count: '0' })).valid).toBe(false);
    expect(validateInputs(state({ count: '1001' })).valid).toBe(false);
    expect(validateInputs(state({ count: '2.5' })).valid).toBe(false);
    expect(validateInputs(state({ count: String(MAX_COUNT) })).valid).toBe(true);
  });

  it('rejects unique when range is smaller than count (int)', () => {
    const s = state({ min: '1', max: '5', count: '6', unique: true });
    expect(validateInputs(s).valid).toBe(false);
  });

  it('accepts unique when range is at least count (int)', () => {
    const s = state({ min: '1', max: '10', count: '10', unique: true });
    expect(validateInputs(s).valid).toBe(true);
  });

  it('rejects dec mode with 0 decimals', () => {
    expect(validateInputs(state({ mode: 'dec', decimals: '0' })).valid).toBe(false);
  });
});

describe('randomInt / randomFloat bounds', () => {
  it('randomInt is always within [min, max] inclusive across many seeds', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed);
      for (let i = 0; i < 200; i++) {
        const value = randomInt(-17, 42, rng);
        expect(value).toBeGreaterThanOrEqual(-17);
        expect(value).toBeLessThanOrEqual(42);
        expect(Number.isInteger(value)).toBe(true);
      }
    }
  });

  it('randomInt returns min for a degenerate range', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(randomInt(7, 7, seeded(seed))).toBe(7);
    }
  });

  it('randomFloat is within [min, max)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed);
      for (let i = 0; i < 100; i++) {
        const value = randomFloat(-2.5, 7.25, rng);
        expect(value).toBeGreaterThanOrEqual(-2.5);
        expect(value).toBeLessThan(7.25);
      }
    }
  });
});

describe('generate — in-bounds guarantee', () => {
  it('int mode always returns in-bounds integers', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = seeded(seed);
      const result = generate(-50, 50, 100, 'int', 0, false, rng);
      expect(result.error).toBeUndefined();
      for (const value of result.values) {
        expect(value).toBeGreaterThanOrEqual(-50);
        expect(value).toBeLessThanOrEqual(50);
        expect(Number.isInteger(value)).toBe(true);
      }
    }
  });

  it('dec mode respects the min/max range', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = seeded(seed);
      const result = generate(2.5, 7.5, 100, 'dec', 3, false, rng);
      expect(result.error).toBeUndefined();
      for (const value of result.values) {
        expect(value).toBeGreaterThanOrEqual(2.5);
        expect(value).toBeLessThanOrEqual(7.5);
      }
    }
  });

  it('returns an error for invalid range or count', () => {
    expect(generate(10, 1, 5, 'int', 0, false).error).toBeDefined();
    expect(generate(1, 10, 0, 'int', 0, false).error).toBeDefined();
    expect(generate(1, 10, MAX_COUNT + 1, 'int', 0, false).error).toBeDefined();
  });
});

describe('generate — unique mode', () => {
  it('full-range unique draw consumes all values without duplicates', () => {
    const result = generate(1, 100, 100, 'int', 0, true, seeded(42));
    expect(result.error).toBeUndefined();
    expect(result.values).toHaveLength(100);
    expect(new Set(result.values).size).toBe(100);
    expect([...result.values].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 100 }, (_, i) => i + 1)
    );
  });

  it('partial unique draws have no duplicates and stay in bounds', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const result = generate(0, 1000, 50, 'int', 0, true, seeded(seed));
      expect(result.values).toHaveLength(50);
      expect(new Set(result.values).size).toBe(50);
      for (const value of result.values) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1000);
      }
    }
  });

  it('unique decimal draws have no duplicates', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const result = generate(0, 100, 30, 'dec', 2, true, seeded(seed));
      expect(result.error).toBeUndefined();
      expect(result.values).toHaveLength(30);
      expect(new Set(result.values).size).toBe(30);
    }
  });

  it('unique int draw fails when range is too small', () => {
    expect(generate(1, 3, 5, 'int', 0, true).error).toBeDefined();
  });
});

describe('generate — decimal precision', () => {
  it('respects the configured decimal places', () => {
    for (const decimals of [1, 2, 3, 4, 5]) {
      for (let seed = 1; seed <= 20; seed++) {
        const result = generate(0, 100, 50, 'dec', decimals, false, seeded(seed));
        for (const value of result.values) {
          const asString = value.toFixed(decimals);
          expect(
            Math.abs(value * 10 ** decimals - Math.round(value * 10 ** decimals))
          ).toBeLessThan(1e-9);
          expect(asString.length).toBeLessThanOrEqual(decimals + 4);
        }
      }
    }
  });

  it('always rounds to at most the configured digits', () => {
    const result = generate(0, 10, 200, 'dec', 2, false, seeded(7));
    for (const value of result.values) {
      expect(Number(value.toFixed(2))).toBe(value);
    }
  });
});

describe('getStats', () => {
  it('computes sum, average, min and max', () => {
    const stats = getStats([1, 2, 3, 4]);
    expect(stats).toEqual({ sum: 10, average: 2.5, min: 1, max: 4 });
  });

  it('handles single value and negatives', () => {
    expect(getStats([42])).toEqual({ sum: 42, average: 42, min: 42, max: 42 });
    expect(getStats([-5, 5])).toEqual({ sum: 0, average: 0, min: -5, max: 5 });
  });

  it('returns null for empty input', () => {
    expect(getStats([])).toBeNull();
  });

  it('matches stats computed from generated output', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { values } = generate(-20, 20, 30, 'int', 0, false, seeded(seed));
      const stats = getStats(values);
      if (!stats) throw new Error('stats missing');
      const manualSum = values.reduce((a, b) => a + b, 0);
      expect(stats.sum).toBe(manualSum);
      expect(stats.average).toBeCloseTo(manualSum / values.length, 10);
      expect(stats.min).toBe(Math.min(...values));
      expect(stats.max).toBe(Math.max(...values));
    }
  });
});

describe('joinValues / resultText / summaryText', () => {
  it('joins with comma, space and newline separators', () => {
    expect(joinValues([1, 2, 3], 0, 'comma')).toBe('1, 2, 3');
    expect(joinValues([1, 2, 3], 0, 'space')).toBe('1 2 3');
    expect(joinValues([1, 2, 3], 0, 'newline')).toBe('1\n2\n3');
  });

  it('formats decimals when joining', () => {
    expect(joinValues([1.5, 2.25], 2, 'comma')).toBe('1.50, 2.25');
  });

  it('resultText previews first values and total count', () => {
    expect(resultText(state({ values: [1, 2, 3] }))).toBe('1, 2, 3');
    const long = state({ values: Array.from({ length: 8 }, (_, i) => i + 1) });
    expect(resultText(long)).toBe('1, 2, 3, 4, 5 … (+3 more)');
    expect(resultText(state({ values: [] }))).toBeNull();
  });

  it('summaryText describes values or prompts to generate', () => {
    expect(summaryText(state({ values: [] }))).toBe('RNG: press Generate');
    expect(summaryText(state({ values: [1], min: '1', max: '2' }))).toBe('RNG: 1 value in [1, 2]');
  });
});

describe('withHistory', () => {
  it('prepends entries newest first and caps history', () => {
    let s = DEFAULT_STATE;
    for (let i = 0; i < 25; i++) {
      s = withHistory(s, `run ${i}`, 'settings', new Date(2026, 0, 1, 0, 0, i));
    }
    expect(s.history).toHaveLength(20);
    expect(s.history[0]?.text).toBe('run 24');
    expect(s.history[19]?.text).toBe('run 5');
  });
});

describe('serialize/deserialize round-trip', () => {
  it('round-trips a full state', () => {
    const s = state({
      mode: 'dec',
      min: '0',
      max: '1',
      count: '5',
      decimals: '3',
      unique: true,
      values: [0.123, 0.456],
      history: [{ text: 'run', settings: '{}', createdAt: '2026-11-23T10:00:00.000Z' }],
    });
    expect(roundTrips(s)).toBe(true);
    const restored = deserializeState(JSON.parse(serializeState(s)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data).toEqual(s);
    }
  });

  it('round-trips the default state', () => {
    expect(roundTrips(DEFAULT_STATE)).toBe(true);
  });

  it('repairs invalid payloads with defaults', () => {
    const repaired = deserializeState({ nope: true });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.data.mode).toBe(DEFAULT_STATE.mode);
      expect(repaired.data.min).toBe(DEFAULT_STATE.min);
      expect(repaired.data.values).toEqual([]);
      expect(repaired.data.history).toEqual([]);
    }
  });

  it('drops non-finite values and bad history entries', () => {
    const repaired = deserializeState({
      ...DEFAULT_STATE,
      values: [1, 'x', Number.NaN, 2.5, null],
      history: [{ text: 'ok', settings: 's', createdAt: '2026-11-23T10:00:00.000Z' }, 5],
    });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.data.values).toEqual([1, 2.5]);
      expect(repaired.data.history).toHaveLength(1);
    }
  });

  it('rejects non-object payloads', () => {
    expect(deserializeState('nope').success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
    expect(deserializeState(null).success).toBe(false);
  });

  it('exposes the tool with serialize/deserialize and exporters', async () => {
    expect(randomNumberGeneratorTool.id).toBe('random-number-generator');
    expect(randomNumberGeneratorTool.name).toBe('Random Number Generator');
    const serial = serializeState(DEFAULT_STATE);
    expect(typeof serial).toBe('string');
    expect(deserializeState(JSON.parse(serial)).success).toBe(true);
    expect(randomNumberGeneratorTool.exporters).toHaveLength(4);
    const exportersList = randomNumberGeneratorTool.exporters ?? [];
    const first = exportersList[0];
    expect(first).toBeDefined();
    if (!first) throw new Error('missing exporter');
    const png = await first.loader();
    const resolved = 'default' in png ? png.default : png.exporter;
    expect(resolved.format).toBe('png');
  });
});
