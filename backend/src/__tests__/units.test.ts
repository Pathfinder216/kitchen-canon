import { describe, it, expect } from 'vitest';
import { normalizeUnit, CANONICAL_UNITS } from '../constants/units.js';

describe('normalizeUnit', () => {
  it('normalizes long forms to canonical abbreviations', () => {
    expect(normalizeUnit('tablespoons')).toBe('tbsp');
    expect(normalizeUnit('tablespoon')).toBe('tbsp');
    expect(normalizeUnit('teaspoons')).toBe('tsp');
    expect(normalizeUnit('ounce')).toBe('oz');
    expect(normalizeUnit('pounds')).toBe('lb');
    expect(normalizeUnit('grams')).toBe('g');
    expect(normalizeUnit('milliliters')).toBe('ml');
    expect(normalizeUnit('litre')).toBe('l');
  });

  it('handles the case-sensitive T (tbsp) vs t (tsp) shorthand', () => {
    expect(normalizeUnit('T')).toBe('tbsp');
    expect(normalizeUnit('t')).toBe('tsp');
  });

  it('is case-insensitive for everything else', () => {
    expect(normalizeUnit('Grams')).toBe('g');
    expect(normalizeUnit('TBSP')).toBe('tbsp');
    expect(normalizeUnit('Cup')).toBe('cup');
    expect(normalizeUnit('LB')).toBe('lb');
  });

  it('collapses periods and plurals', () => {
    expect(normalizeUnit('lb.')).toBe('lb');
    expect(normalizeUnit('oz.')).toBe('oz');
    expect(normalizeUnit('cloves')).toBe('clove');
    expect(normalizeUnit('slices')).toBe('slice');
  });

  it('passes through unrecognized units (trimmed + lowercased)', () => {
    expect(normalizeUnit('handful')).toBe('handful');
    expect(normalizeUnit('  Handful  ')).toBe('handful');
    expect(normalizeUnit('splash')).toBe('splash');
  });

  it('returns null for empty / null / undefined', () => {
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit(undefined)).toBeNull();
    expect(normalizeUnit('')).toBeNull();
    expect(normalizeUnit('   ')).toBeNull();
  });

  it('is idempotent — canonical forms map to themselves', () => {
    for (const unit of CANONICAL_UNITS) {
      expect(normalizeUnit(unit.canonical)).toBe(unit.canonical);
    }
  });
});

describe('unit conversion table (plan 27)', () => {
  const byName = (name: string) => CANONICAL_UNITS.find((u) => u.canonical === name)!;
  const toBase = (name: string, amount: number) => amount * byName(name).conversion!.toBase;
  const fromBase = (name: string, base: number) => base / byName(name).conversion!.toBase;

  it('gives every volume/weight unit a conversion and no count unit one', () => {
    for (const unit of CANONICAL_UNITS) {
      if (unit.kind === 'volume') expect(unit.conversion?.base).toBe('ml');
      else if (unit.kind === 'weight') expect(unit.conversion?.base).toBe('g');
      else expect(unit.conversion).toBeUndefined();
    }
  });

  it('has metric identity units', () => {
    expect(byName('ml').conversion).toEqual({ toBase: 1, base: 'ml' });
    expect(byName('g').conversion).toEqual({ toBase: 1, base: 'g' });
    expect(byName('l').conversion!.toBase).toBe(1000);
    expect(byName('kg').conversion!.toBase).toBe(1000);
  });

  it('matches known kitchen equivalences', () => {
    expect(toBase('cup', 1)).toBeCloseTo(236.6, 1);
    expect(toBase('tbsp', 3)).toBeCloseTo(toBase('tsp', 9), 1);
    expect(toBase('cup', 1)).toBeCloseTo(toBase('tbsp', 16), 0);
    expect(toBase('qt', 1)).toBeCloseTo(toBase('pt', 2), 1);
    expect(toBase('gal', 1)).toBeCloseTo(toBase('qt', 4), 0);
    expect(toBase('lb', 1)).toBeCloseTo(toBase('oz', 16), 1);
  });

  it('round-trips through the base unit', () => {
    for (const unit of CANONICAL_UNITS) {
      if (!unit.conversion) continue;
      expect(fromBase(unit.canonical, toBase(unit.canonical, 2.5))).toBeCloseTo(2.5, 10);
    }
  });
});
