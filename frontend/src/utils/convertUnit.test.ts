import { describe, it, expect } from 'vitest';
import { UNIT_CONVERSIONS, convertForDisplay, formatQuantity } from './convertUnit';

describe('UNIT_CONVERSIONS (mirror of backend constants/units.ts)', () => {
  it('round-trips every unit through its base', () => {
    for (const [unit, { toBase }] of Object.entries(UNIT_CONVERSIONS)) {
      expect((2.5 * toBase) / toBase, unit).toBeCloseTo(2.5, 10);
    }
  });

  it('matches kitchen equivalences', () => {
    const ml = (u: string, n = 1) => n * UNIT_CONVERSIONS[u].toBase;
    expect(ml('cup')).toBeCloseTo(ml('tbsp', 16), 0);
    expect(ml('tbsp')).toBeCloseTo(ml('tsp', 3), 1);
    expect(ml('lb')).toBeCloseTo(ml('oz', 16), 1);
  });
});

describe('convertForDisplay', () => {
  it('is a no-op for the original preference', () => {
    expect(convertForDisplay(0.5, 'cup', 'original')).toEqual({ amount: 0.5, unit: 'cup', converted: false });
    expect(convertForDisplay(830, 'ml', 'original')).toEqual({ amount: 830, unit: 'ml', converted: false });
  });

  it('leaves count, unknown, and missing units alone', () => {
    expect(convertForDisplay(2, 'clove', 'metric').converted).toBe(false);
    expect(convertForDisplay(1, 'can', 'imperial').converted).toBe(false);
    expect(convertForDisplay(1, 'handful', 'metric').converted).toBe(false);
    expect(convertForDisplay(3, null, 'metric')).toEqual({ amount: 3, unit: null, converted: false });
  });

  it('never re-expresses a unit that is already in the target system', () => {
    expect(convertForDisplay(24, 'oz', 'imperial')).toEqual({ amount: 24, unit: 'oz', converted: false });
    expect(convertForDisplay(1500, 'ml', 'metric')).toEqual({ amount: 1500, unit: 'ml', converted: false });
  });

  it('picks the largest metric unit ≥ 1 (830 ml, not 0.83 l)', () => {
    // 3 ½ cups = 828 ml → rounded to the nearest 5 ml from 100 up
    expect(convertForDisplay(3.5, 'cup', 'metric')).toMatchObject({ amount: 830, unit: 'ml' });
    expect(convertForDisplay(5, 'cup', 'metric')).toMatchObject({ amount: 1.18, unit: 'l' });
    expect(convertForDisplay(3, 'lb', 'metric')).toMatchObject({ amount: 1.36, unit: 'kg' });
  });

  it('rounds metric to whole ml/g (nearest 5 from 100 up)', () => {
    expect(convertForDisplay(0.5, 'cup', 'metric')).toMatchObject({ amount: 120, unit: 'ml' });
    expect(convertForDisplay(1, 'tsp', 'metric')).toMatchObject({ amount: 5, unit: 'ml' });
    expect(convertForDisplay(1, 'tbsp', 'metric')).toMatchObject({ amount: 15, unit: 'ml' });
    expect(convertForDisplay(1, 'oz', 'metric')).toMatchObject({ amount: 28, unit: 'g' });
  });

  it('never rounds a real amount down to zero', () => {
    const q = convertForDisplay(0.05, 'tsp', 'metric');
    expect(q.amount).toBeGreaterThan(0);
    expect(q.unit).toBe('ml');
  });

  it('picks the largest imperial unit ≥ 1 (1 ½ lb, not 24 oz)', () => {
    expect(convertForDisplay(680, 'g', 'imperial')).toMatchObject({ amount: 1.5, unit: 'lb' });
    expect(convertForDisplay(227, 'g', 'imperial')).toMatchObject({ amount: 8, unit: 'oz' });
    expect(convertForDisplay(1, 'kg', 'imperial')).toMatchObject({ amount: 2.25, unit: 'lb' });
  });

  it('prefers cups from ¼ cup up, then tbsp, then tsp for small volumes', () => {
    expect(convertForDisplay(60, 'ml', 'imperial')).toMatchObject({ amount: 0.25, unit: 'cup' });
    expect(convertForDisplay(250, 'ml', 'imperial')).toMatchObject({ amount: 1, unit: 'cup' });
    expect(convertForDisplay(30, 'ml', 'imperial')).toMatchObject({ amount: 2, unit: 'tbsp' });
    expect(convertForDisplay(5, 'ml', 'imperial')).toMatchObject({ amount: 1, unit: 'tsp' });
    expect(convertForDisplay(2, 'l', 'imperial')).toMatchObject({ amount: 2, unit: 'qt' });
  });

  it('snaps cups to common fractions', () => {
    expect(convertForDisplay(80, 'ml', 'imperial')).toMatchObject({ amount: 1 / 3, unit: 'cup' });
    expect(convertForDisplay(160, 'ml', 'imperial')).toMatchObject({ amount: 2 / 3, unit: 'cup' });
    expect(convertForDisplay(180, 'ml', 'imperial')).toMatchObject({ amount: 0.75, unit: 'cup' });
  });

  it('accepts legacy long/plural spellings as sources', () => {
    expect(convertForDisplay(2, 'cups', 'metric')).toMatchObject({ amount: 475, unit: 'ml' });
    expect(convertForDisplay(1, 'pounds', 'metric')).toMatchObject({ amount: 455, unit: 'g' });
    expect(convertForDisplay(2, 'lbs', 'metric')).toMatchObject({ amount: 905, unit: 'g' });
  });
});

describe('formatQuantity', () => {
  it('renders exactly what was authored for the original preference', () => {
    expect(formatQuantity(0.5, 'cup', 'original')).toBe('½ cup');
    expect(formatQuantity(3, null, 'original')).toBe('3');
    expect(formatQuantity(null, 'cup', 'original')).toBe('');
  });

  it('renders imperial conversions with fraction glyphs', () => {
    expect(formatQuantity(80, 'ml', 'imperial')).toBe('⅓ cup');
    expect(formatQuantity(680, 'g', 'imperial')).toBe('1 ½ lb');
    expect(formatQuantity(2.5, 'ml', 'imperial')).toBe('½ tsp');
  });

  it('renders metric conversions as plain decimals', () => {
    expect(formatQuantity(0.5, 'cup', 'metric')).toBe('120 ml');
    expect(formatQuantity(5.3, 'cup', 'metric')).toBe('1.25 l');
  });

  it('leaves count units untouched when converting', () => {
    expect(formatQuantity(2, 'clove', 'metric')).toBe('2 clove');
  });
});
