import { describe, it, expect } from 'vitest';
import {
  draftToNutrition,
  emptyNutritionDraft,
  nutritionSummary,
  nutritionToDraft,
} from './nutrition';
import type { Nutrition } from '../api/nutrition';

const fdc: Nutrition = {
  per100g: { calories: 61, protein: 3.15, fat: 3.25, sodium: 43 },
  gramsPerUnit: { cup: 244, tbsp: 15 },
  source: 'fdc',
  fdcId: 171265,
  fdcDescription: 'Milk, whole, 3.25% milkfat, with added vitamin D',
};

describe('nutrition draft helpers', () => {
  it('round-trips stored nutrition through the string draft', () => {
    expect(draftToNutrition(nutritionToDraft(fdc))).toEqual(fdc);
  });

  it('treats an empty draft as no nutrition', () => {
    expect(draftToNutrition(emptyNutritionDraft())).toBeNull();
    expect(nutritionToDraft(null)).toEqual(emptyNutritionDraft());
  });

  it('drops blank, negative and non-numeric fields and keeps zero', () => {
    const d = emptyNutritionDraft();
    d.values.calories = '120';
    d.values.fat = '';
    d.values.fiber = '0';
    d.values.sugar = '-2';
    d.values.sodium = 'abc';
    expect(draftToNutrition(d)).toEqual({ per100g: { calories: 120, fiber: 0 }, source: 'manual' });
  });

  it('can relabel the source when drafting (copy from similar)', () => {
    expect(draftToNutrition(nutritionToDraft(fdc, 'copied'))).toEqual({ ...fdc, source: 'copied' });
  });

  it('summarizes calories and protein', () => {
    expect(nutritionSummary(fdc)).toBe('61 kcal · 3.2 g protein / 100 g');
    expect(nutritionSummary({ per100g: { fat: 1 }, source: 'manual' })).toBe('nutrition recorded');
    expect(nutritionSummary(null)).toBeNull();
  });
});
