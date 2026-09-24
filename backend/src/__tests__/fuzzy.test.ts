import { describe, it, expect } from 'vitest';
import {
  normalize,
  diceSimilarity,
  fuzzyScore,
  rankFuzzy,
  TYPEAHEAD_THRESHOLD,
  FILTER_THRESHOLD,
  TITLE_THRESHOLD,
} from '../utils/fuzzy.js';

describe('normalize', () => {
  it('lowercases, strips punctuation and diacritics, and collapses whitespace', () => {
    expect(normalize('  Sun-Dried   TOMATOES! ')).toBe('sun dried tomatoes');
    expect(normalize("Grandma's Jalapeño")).toBe('grandmas jalapeno');
    expect(normalize('...')).toBe('');
  });
});

describe('diceSimilarity', () => {
  it('is 1 for identical strings (after normalization) and 0 for empty input', () => {
    expect(diceSimilarity('Basil', ' basil ')).toBe(1);
    expect(diceSimilarity('', 'basil')).toBe(0);
  });

  it('is symmetric', () => {
    expect(diceSimilarity('tomatos', 'tomatoes')).toBeCloseTo(diceSimilarity('tomatoes', 'tomatos'));
  });

  it.each([
    ['tomatos', 'tomatoes'],
    ['chiken', 'chicken'],
    ['brocolli', 'broccoli'],
    ['parmesean', 'parmesan'],
    ['cinamon', 'cinnamon'],
  ])('scores the typo %s ≈ %s above the typeahead threshold', (typo, word) => {
    expect(diceSimilarity(typo, word)).toBeGreaterThanOrEqual(TYPEAHEAD_THRESHOLD);
  });

  it.each([
    ['salt', 'basalt'],
    ['rice', 'licorice'],
    ['corn', 'popcorn'],
    ['pear', 'pepper'],
    ['lime', 'thyme'],
  ])('keeps %s vs %s below the typeahead threshold', (a, b) => {
    expect(diceSimilarity(a, b)).toBeLessThan(TYPEAHEAD_THRESHOLD);
  });
});

describe('fuzzyScore', () => {
  it('matches a misspelled word against a multi-word name via token overlap', () => {
    expect(fuzzyScore('chiken', 'chicken breast')).toBeGreaterThanOrEqual(FILTER_THRESHOLD);
    expect(fuzzyScore('chiken breast', 'chicken breast')).toBeGreaterThanOrEqual(FILTER_THRESHOLD);
  });

  it('averages over query words, so one shared word is not enough', () => {
    expect(fuzzyScore('red chiken', 'red pepper')).toBeLessThan(TYPEAHEAD_THRESHOLD);
  });

  it('matches misspelled recipe titles', () => {
    expect(fuzzyScore('chiken soup', 'Chicken Soup')).toBeGreaterThanOrEqual(TITLE_THRESHOLD);
    expect(fuzzyScore('lasagne', "Grandma's Lasagna")).toBeGreaterThanOrEqual(TITLE_THRESHOLD);
    expect(fuzzyScore('pancakes', 'Chicken Soup')).toBeLessThan(TITLE_THRESHOLD);
  });

  it('keeps salt away from basalt', () => {
    expect(fuzzyScore('salt', 'basalt')).toBeLessThan(TYPEAHEAD_THRESHOLD);
  });
});

describe('rankFuzzy', () => {
  const items = [
    { name: 'cherry tomatoes', aliases: [] as string[] },
    { name: 'tomatoes', aliases: ['tomato'] },
    { name: 'potatoes', aliases: ['potato'] },
    { name: 'basalt', aliases: [] },
  ];
  const names = (i: (typeof items)[number]) => [i.name, ...i.aliases];

  it('ranks best-first and prefers the closer whole-string match on ties', () => {
    const ranked = rankFuzzy('tomatos', items, names, TYPEAHEAD_THRESHOLD);
    expect(ranked[0].item.name).toBe('tomatoes');
    expect(ranked.map((r) => r.item.name)).toContain('cherry tomatoes');
    expect(ranked.map((r) => r.item.name)).not.toContain('basalt');
  });

  it('drops everything below the threshold', () => {
    expect(rankFuzzy('salt', items, names, TYPEAHEAD_THRESHOLD)).toEqual([]);
  });
});
