import { describe, it, expect } from 'vitest';
import {
  scoreCandidates,
  type RecipeFacts,
  type ScoredCandidate,
  type SuggestionRule,
} from '../services/suggestions.service.js';

const NOW = new Date('2026-09-24T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const ALL_DIETS = ['dairy_free', 'gluten_free', 'nut_free', 'pescatarian', 'vegan', 'vegetarian'];
const VEGETARIAN_DIETS = ['gluten_free', 'nut_free', 'pescatarian', 'vegetarian'];
const MEAT_DIETS = ['dairy_free', 'gluten_free', 'nut_free'];

/** A neutral recipe: no courses, no labels, no ingredients, cooked yesterday (so no novelty bonus). */
function facts(id: string, over: Partial<RecipeFacts> = {}): RecipeFacts {
  return {
    id,
    title: id,
    servings: 4,
    courses: [],
    diets: [],
    allergens: [],
    catalogIds: [],
    lastCookedAt: new Date(NOW.getTime() - DAY),
    ...over,
  };
}

function score(selection: RecipeFacts[], candidates: RecipeFacts[]): ScoredCandidate[] {
  return scoreCandidates(selection, candidates, { now: NOW });
}

function only(selection: RecipeFacts[], candidate: RecipeFacts): ScoredCandidate {
  return score(selection, [candidate])[0];
}

function pointsFor(scored: ScoredCandidate, rule: SuggestionRule): number {
  return scored.breakdown.filter((c) => c.rule === rule).reduce((s, c) => s + c.points, 0);
}

describe('scoreCandidates — course complement (+3)', () => {
  it('boosts mains when the selection has no main', () => {
    const side = facts('side', { courses: ['SIDE'] });
    const s = only([side], facts('main', { courses: ['MAIN'] }));
    expect(pointsFor(s, 'course-complement')).toBe(3);
    expect(s.reasons).toContain('fills main course');
  });

  it('does not boost sides when the selection has no main', () => {
    const dessert = facts('dessert', { courses: ['DESSERT'] });
    const s = only([dessert], facts('side', { courses: ['SIDE'] }));
    expect(pointsFor(s, 'course-complement')).toBe(0);
  });

  it('boosts each missing side/salad/bread/dessert once a main is selected', () => {
    const main = facts('main', { courses: ['MAIN'] });
    for (const course of ['SIDE', 'SALAD', 'BREAD', 'DESSERT']) {
      const s = only([main], facts('c', { courses: [course] }));
      expect(pointsFor(s, 'course-complement')).toBe(3);
      expect(s.reasons).toContain(`fills ${course.toLowerCase()} course`);
    }
  });

  it('gives no boost to courses outside the target composition', () => {
    const main = facts('main', { courses: ['MAIN'] });
    expect(pointsFor(only([main], facts('drink', { courses: ['DRINK'] })), 'course-complement')).toBe(0);
    expect(pointsFor(only([main], facts('none')), 'course-complement')).toBe(0);
  });

  it('counts the complement once even when a candidate fills several courses', () => {
    const main = facts('main', { courses: ['MAIN'] });
    const s = only([main], facts('c', { courses: ['SIDE', 'SALAD'] }));
    expect(pointsFor(s, 'course-complement')).toBe(3);
    expect(s.reasons).toContain('fills side course');
  });
});

describe('scoreCandidates — course redundancy (−2 per covered course)', () => {
  it('penalises a course the selection already has', () => {
    const main = facts('main', { courses: ['MAIN'] });
    const s = only([main], facts('main2', { courses: ['MAIN'] }));
    expect(pointsFor(s, 'course-redundancy')).toBe(-2);
    expect(s.breakdown).toContainEqual(expect.objectContaining({ reason: 'meal already has a main' }));
    expect(s.reasons).not.toContain('meal already has a main');
  });

  it('penalises every covered course', () => {
    const saladMain = facts('sm', { courses: ['MAIN', 'SALAD'] });
    const s = only([saladMain], facts('sm2', { courses: ['MAIN', 'SALAD'] }));
    expect(pointsFor(s, 'course-redundancy')).toBe(-4);
  });
});

describe('scoreCandidates — diet compatibility', () => {
  it('+2 when the candidate keeps every diet the selection shares', () => {
    const veg = facts('veg', { diets: VEGETARIAN_DIETS });
    const s = only([veg], facts('c', { diets: ALL_DIETS }));
    expect(pointsFor(s, 'diet')).toBe(2);
    expect(s.reasons).toContain('keeps meal vegetarian');
  });

  it('uses the intersection of the selection diets', () => {
    const vegan = facts('a', { diets: ALL_DIETS });
    const veg = facts('b', { diets: VEGETARIAN_DIETS });
    // Candidate is vegetarian but not vegan — still keeps the (vegetarian) meal.
    const s = only([vegan, veg], facts('c', { diets: VEGETARIAN_DIETS }));
    expect(pointsFor(s, 'diet')).toBe(2);
    expect(s.reasons).toContain('keeps meal vegetarian');
  });

  it('−2 when the candidate breaks a shared diet', () => {
    const veg = facts('veg', { diets: VEGETARIAN_DIETS });
    const s = only([veg], facts('meat', { diets: MEAT_DIETS }));
    expect(pointsFor(s, 'diet')).toBe(-2);
    expect(s.breakdown).toContainEqual(expect.objectContaining({ rule: 'diet', reason: 'breaks vegetarian meal' }));
  });

  it('does not fire when the selection shares no diet', () => {
    const plain = facts('plain', { diets: [] });
    expect(pointsFor(only([plain], facts('c', { diets: ALL_DIETS })), 'diet')).toBe(0);
    expect(pointsFor(only([], facts('c', { diets: ALL_DIETS })), 'diet')).toBe(0);
  });
});

describe('scoreCandidates — allergen introduction (−3)', () => {
  it('penalises an allergen absent from every selected recipe', () => {
    const sel = facts('sel', { allergens: ['eggs'] });
    const s = only([sel], facts('c', { allergens: ['dairy', 'eggs', 'tree_nuts'] }));
    expect(pointsFor(s, 'allergen')).toBe(-3);
    expect(s.breakdown).toContainEqual(expect.objectContaining({ rule: 'allergen', reason: 'adds dairy, tree nuts' }));
  });

  it('does not penalise allergens the meal already has', () => {
    const a = facts('a', { allergens: ['dairy'] });
    const b = facts('b', { allergens: ['gluten'] });
    expect(pointsFor(only([a, b], facts('c', { allergens: ['dairy', 'gluten'] })), 'allergen')).toBe(0);
  });

  it('does not fire for an empty selection', () => {
    expect(pointsFor(only([], facts('c', { allergens: ['dairy'] })), 'allergen')).toBe(0);
  });
});

describe('scoreCandidates — ingredient overlap (+0.5 each, max +1.5)', () => {
  it('adds half a point per shared catalog ingredient', () => {
    const sel = facts('sel', { catalogIds: ['oil', 'garlic', 'lemon'] });
    const s = only([sel], facts('c', { catalogIds: ['oil', 'garlic', 'rice'] }));
    expect(pointsFor(s, 'overlap')).toBe(1);
    expect(s.reasons).toContain('shares 2 ingredients');
  });

  it('caps at 1.5', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const s = only([facts('sel', { catalogIds: ids })], facts('c', { catalogIds: ids }));
    expect(pointsFor(s, 'overlap')).toBe(1.5);
  });

  it('does not fire without overlap', () => {
    expect(pointsFor(only([facts('sel', { catalogIds: ['a'] })], facts('c', { catalogIds: ['b'] })), 'overlap')).toBe(0);
  });
});

describe('scoreCandidates — history novelty (+1)', () => {
  it('rewards never-cooked recipes', () => {
    const s = only([], facts('c', { lastCookedAt: null }));
    expect(pointsFor(s, 'novelty')).toBe(1);
    expect(s.reasons).toContain('not cooked recently');
  });

  it('rewards recipes last cooked more than 30 days ago', () => {
    expect(pointsFor(only([], facts('c', { lastCookedAt: new Date(NOW.getTime() - 31 * DAY) })), 'novelty')).toBe(1);
  });

  it('does not reward recipes cooked in the last 30 days', () => {
    expect(pointsFor(only([], facts('c', { lastCookedAt: new Date(NOW.getTime() - 29 * DAY) })), 'novelty')).toBe(0);
  });
});

describe('scoreCandidates — combined behaviour', () => {
  it('salad main selected → side dishes outrank other salads', () => {
    const saladMain = facts('caesar', { title: 'Caesar salad', courses: ['MAIN', 'SALAD'], diets: VEGETARIAN_DIETS });
    const ranked = score([saladMain], [
      facts('greek', { title: 'Greek salad', courses: ['SALAD'], diets: VEGETARIAN_DIETS, lastCookedAt: null }),
      facts('cobb', { title: 'Cobb salad', courses: ['MAIN', 'SALAD'], diets: MEAT_DIETS, lastCookedAt: null }),
      facts('fries', { title: 'Fries', courses: ['SIDE'], diets: ALL_DIETS }),
      facts('bread', { title: 'Focaccia', courses: ['BREAD'], diets: VEGETARIAN_DIETS }),
      facts('tart', { title: 'Lemon tart', courses: ['DESSERT'], diets: VEGETARIAN_DIETS }),
    ]);
    const order = ranked.map((r) => r.recipe.id);
    // Side/bread/dessert (+3 course, +2 diet = 5) beat the never-cooked Greek salad (−2 +2 +1 = 1).
    expect(order.slice(0, 3).sort()).toEqual(['bread', 'fries', 'tart']);
    expect(order.indexOf('greek')).toBeGreaterThan(2);
    expect(order[order.length - 1]).toBe('cobb');
    expect(ranked[0].reasons).toEqual(expect.arrayContaining(['keeps meal vegetarian']));
  });

  it('vegetarian selection → meat mains fall below vegetarian mains', () => {
    const vegSide = facts('side', { courses: ['SIDE'], diets: VEGETARIAN_DIETS });
    const ranked = score([vegSide], [
      facts('steak', { courses: ['MAIN'], diets: MEAT_DIETS }),
      facts('risotto', { courses: ['MAIN'], diets: VEGETARIAN_DIETS }),
    ]);
    expect(ranked.map((r) => r.recipe.id)).toEqual(['risotto', 'steak']);
    expect(ranked[0].score).toBe(5);
    expect(ranked[1].score).toBe(1);
  });

  it('empty selection → mains first, then never-cooked recipes (course-target scoring only)', () => {
    const ranked = score([], [
      facts('dessert', { courses: ['DESSERT'], lastCookedAt: null }),
      facts('main-recent', { courses: ['MAIN'] }),
      facts('main-new', { courses: ['MAIN'], lastCookedAt: null }),
      facts('side', { courses: ['SIDE'] }),
    ]);
    expect(ranked.map((r) => [r.recipe.id, r.score])).toEqual([
      ['main-new', 4],
      ['main-recent', 3],
      ['dessert', 1],
      ['side', 0],
    ]);
  });

  it('allergen-free meal → an allergen-introducing side ranks below a clean one', () => {
    const main = facts('main', { courses: ['MAIN'] });
    const ranked = score([main], [
      facts('buttery', { title: 'A buttery mash', courses: ['SIDE'], allergens: ['dairy'] }),
      facts('clean', { title: 'Z roast veg', courses: ['SIDE'] }),
    ]);
    expect(ranked.map((r) => r.recipe.id)).toEqual(['clean', 'buttery']);
    expect(ranked[1].score).toBe(0);
  });

  it('breaks ties by title', () => {
    const ranked = score([], [facts('b', { title: 'Beta' }), facts('a', { title: 'Alpha' })]);
    expect(ranked.map((r) => r.recipe.id)).toEqual(['a', 'b']);
  });

  it('score equals the sum of the breakdown', () => {
    const sel = facts('sel', { courses: ['MAIN'], diets: VEGETARIAN_DIETS, catalogIds: ['x'] });
    const s = only([sel], facts('c', { courses: ['SIDE'], diets: ALL_DIETS, catalogIds: ['x'], allergens: ['soy'], lastCookedAt: null }));
    expect(s.score).toBe(3 + 2 - 3 + 0.5 + 1);
    expect(s.score).toBe(s.breakdown.reduce((sum, c) => sum + c.points, 0));
  });
});
