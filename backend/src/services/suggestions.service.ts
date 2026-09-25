/**
 * Complementary recipe suggestions for meal planning (plan 40).
 *
 * Transparent rules, no ML — every point a candidate earns comes with a human-readable reason so
 * the UI can explain *why* a recipe is suggested:
 *
 *   1. Course complement (+3): the candidate fills a course the selection is missing. Target
 *      composition is MAIN + SIDE (+ optional SALAD / BREAD / DESSERT): with no MAIN selected the
 *      mains get the boost, once a MAIN is selected the missing sides/salads/breads/desserts do.
 *   2. Course redundancy (−2 per course): each of the candidate's courses already covered.
 *   3. Diet compatibility: candidate's diet labels ⊇ the diets every selected recipe shares → +2
 *      ("keeps meal vegetarian"); otherwise −2 ("breaks vegetarian meal"). Allergen introduction
 *      (−3): the candidate contains an allergen no selected recipe has.
 *   4. Ingredient overlap (+0.5 per shared catalog ingredient, max +1.5).
 *   5. History novelty (+1): not cooked in the last 30 days.
 *
 * `scoreCandidates` is pure (plain data in, plain data out, no Prisma) so it can be unit-tested
 * exhaustively; `getSuggestions` is the DB loader the route calls.
 */

import { prisma } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { DIETS } from '../constants/dietaryTags.js';

export const COURSE_COMPLEMENT_POINTS = 3;
export const COURSE_REDUNDANCY_POINTS = -2;
export const DIET_KEEP_POINTS = 2;
export const DIET_BREAK_POINTS = -2;
export const ALLERGEN_PENALTY_POINTS = -3;
export const OVERLAP_POINTS_EACH = 0.5;
export const OVERLAP_POINTS_MAX = 1.5;
export const NOVELTY_POINTS = 1;
export const NOVELTY_DAYS = 30;
/** Maximum number of suggestions returned. */
export const MAX_SUGGESTIONS = 6;
/** Below this many (latest, unarchived) recipes suggestions feel broken, so none are returned. */
export const MIN_RECIPES_FOR_SUGGESTIONS = 5;

/** Courses that complete a meal once a MAIN is chosen, in the order used to name the reason. */
const COMPLEMENT_COURSES = ['SIDE', 'SALAD', 'BREAD', 'DESSERT'] as const;

const COURSE_NAMES: Record<string, string> = {
  APPETIZER: 'appetizer',
  SOUP: 'soup',
  SALAD: 'salad',
  BREAD: 'bread',
  MAIN: 'main',
  SIDE: 'side',
  DESSERT: 'dessert',
  BREAKFAST: 'breakfast',
  SNACK: 'snack',
  DRINK: 'drink',
  TOPPING: 'topping',
};

const DIET_NAMES: Record<string, string> = {
  vegan: 'vegan',
  vegetarian: 'vegetarian',
  pescatarian: 'pescatarian',
  gluten_free: 'gluten-free',
  dairy_free: 'dairy-free',
  nut_free: 'nut-free',
};

const ALLERGEN_NAMES: Record<string, string> = {
  tree_nuts: 'tree nuts',
};

export interface RecipeFacts {
  id: string;
  title: string;
  servings: number;
  /** CourseType values, e.g. ['MAIN', 'SALAD']. */
  courses: string[];
  /** Auto dietary labels (diets the recipe is compatible with). */
  diets: string[];
  /** Auto allergen labels. */
  allergens: string[];
  /** Distinct catalog ids of the recipe's catalog-resolved ingredients. */
  catalogIds: string[];
  /** Most recent time any version of the recipe was cooked, or null if never. */
  lastCookedAt: Date | null;
}

export type SuggestionRule = 'course-complement' | 'course-redundancy' | 'diet' | 'allergen' | 'overlap' | 'novelty';

export interface ScoreComponent {
  rule: SuggestionRule;
  points: number;
  reason: string;
}

export interface ScoredCandidate {
  recipe: RecipeFacts;
  score: number;
  /** Reasons for the positive contributions — what the UI shows as chips. */
  reasons: string[];
  /** Every rule that fired, positive or negative. */
  breakdown: ScoreComponent[];
}

export interface ScoreOptions {
  /** Reference "now" for the novelty rule (injectable for tests). */
  now?: Date;
}

/** Name the most specific diet in a set, following DIETS order (vegan before vegetarian, …). */
function headlineDiet(diets: Set<string>): string | undefined {
  return DIETS.find((d) => diets.has(d));
}

/**
 * Score every candidate against the current selection. Returns all candidates sorted by score
 * (desc), then title, then id — callers decide how many to keep and whether to drop non-positive
 * scores.
 */
export function scoreCandidates(
  selection: RecipeFacts[],
  candidates: RecipeFacts[],
  options: ScoreOptions = {},
): ScoredCandidate[] {
  const now = options.now ?? new Date();
  const noveltyCutoff = now.getTime() - NOVELTY_DAYS * 24 * 60 * 60 * 1000;

  const selectedCourses = new Set(selection.flatMap((r) => r.courses));
  const hasMain = selectedCourses.has('MAIN');
  const missingTargets: string[] = hasMain
    ? COMPLEMENT_COURSES.filter((c) => !selectedCourses.has(c))
    : ['MAIN'];

  // Diets every selected recipe shares (empty when there is no selection).
  let sharedDiets = new Set<string>();
  if (selection.length > 0) {
    sharedDiets = new Set(selection[0].diets);
    for (const r of selection.slice(1)) {
      sharedDiets = new Set([...sharedDiets].filter((d) => r.diets.includes(d)));
    }
  }
  const selectedAllergens = new Set(selection.flatMap((r) => r.allergens));
  const selectedCatalogIds = new Set(selection.flatMap((r) => r.catalogIds));

  const scored = candidates.map((candidate): ScoredCandidate => {
    const breakdown: ScoreComponent[] = [];

    // 1. Course complement
    const filled = missingTargets.find((c) => candidate.courses.includes(c));
    if (filled) {
      breakdown.push({
        rule: 'course-complement',
        points: COURSE_COMPLEMENT_POINTS,
        reason: `fills ${COURSE_NAMES[filled] ?? filled.toLowerCase()} course`,
      });
    }

    // 2. Course redundancy
    for (const course of candidate.courses) {
      if (selectedCourses.has(course)) {
        const name = COURSE_NAMES[course] ?? course.toLowerCase();
        breakdown.push({
          rule: 'course-redundancy',
          points: COURSE_REDUNDANCY_POINTS,
          reason: `meal already has a ${name}`,
        });
      }
    }

    // 3a. Diet compatibility
    if (sharedDiets.size > 0) {
      const missing = new Set([...sharedDiets].filter((d) => !candidate.diets.includes(d)));
      if (missing.size === 0) {
        const diet = headlineDiet(sharedDiets)!;
        breakdown.push({ rule: 'diet', points: DIET_KEEP_POINTS, reason: `keeps meal ${DIET_NAMES[diet] ?? diet}` });
      } else {
        const diet = headlineDiet(missing)!;
        breakdown.push({ rule: 'diet', points: DIET_BREAK_POINTS, reason: `breaks ${DIET_NAMES[diet] ?? diet} meal` });
      }
    }

    // 3b. Allergen introduction (only meaningful against a non-empty selection)
    if (selection.length > 0) {
      const added = [...candidate.allergens].filter((a) => !selectedAllergens.has(a)).sort();
      if (added.length > 0) {
        breakdown.push({
          rule: 'allergen',
          points: ALLERGEN_PENALTY_POINTS,
          reason: `adds ${added.map((a) => ALLERGEN_NAMES[a] ?? a).join(', ')}`,
        });
      }
    }

    // 4. Ingredient overlap
    const shared = new Set(candidate.catalogIds.filter((id) => selectedCatalogIds.has(id))).size;
    if (shared > 0) {
      breakdown.push({
        rule: 'overlap',
        points: Math.min(shared * OVERLAP_POINTS_EACH, OVERLAP_POINTS_MAX),
        reason: `shares ${shared} ingredient${shared === 1 ? '' : 's'}`,
      });
    }

    // 5. History novelty
    if (!candidate.lastCookedAt || candidate.lastCookedAt.getTime() < noveltyCutoff) {
      breakdown.push({ rule: 'novelty', points: NOVELTY_POINTS, reason: 'not cooked recently' });
    }

    const score = breakdown.reduce((sum, c) => sum + c.points, 0);
    return {
      recipe: candidate,
      score,
      reasons: breakdown.filter((c) => c.points > 0).map((c) => c.reason),
      breakdown,
    };
  });

  return scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.recipe.title.localeCompare(b.recipe.title) ||
      a.recipe.id.localeCompare(b.recipe.id),
  );
}

// ── DB loader ────────────────────────────────────────────────────────────────

export interface SuggestionQuery {
  recipeIds: string[];
  /** Only suggest recipes carrying every one of these diet labels. */
  diets?: string[];
  /** Only suggest recipes free of every one of these allergens. */
  freeFrom?: string[];
}

export interface Suggestion {
  recipe: { id: string; title: string; servings: number; courses: string[] };
  score: number;
  reasons: string[];
  breakdown: ScoreComponent[];
}

/** Effective "cooked" date of a plan: `cookedAt` when set, else its planned date once it has passed. */
function planCookedDate(plan: { cookedAt: Date | null; date: string | null }, now: Date): Date | null {
  if (plan.cookedAt) return plan.cookedAt;
  if (!plan.date) return null;
  const parsed = new Date(plan.date);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() > now.getTime()) return null;
  return parsed;
}

export async function getSuggestions(userId: string, query: SuggestionQuery, now = new Date()): Promise<Suggestion[]> {
  const recipes = await prisma.recipe.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      servings: true,
      parentId: true,
      isLatest: true,
      archived: true,
      courses: { select: { courseType: true } },
      labels: { select: { label: { select: { type: true, name: true } } } },
      ingredients: { select: { catalogId: true } },
    },
  });
  const byId = new Map(recipes.map((r) => [r.id, r]));

  const selectedIds = [...new Set(query.recipeIds)];
  if (selectedIds.some((id) => !byId.has(id))) throw new AppError(404, 'Recipe not found');

  const pool = recipes.filter((r) => r.isLatest && !r.archived);
  if (pool.length < MIN_RECIPES_FOR_SUGGESTIONS) return [];

  // Versions share a chain; key history and "already selected" by the chain's root id so a plan
  // pinning an old version still counts for (and excludes) the latest version.
  const rootCache = new Map<string, string>();
  function rootOf(id: string): string {
    const cached = rootCache.get(id);
    if (cached) return cached;
    const seen: string[] = [];
    let current = id;
    for (;;) {
      seen.push(current);
      const parent = byId.get(current)?.parentId;
      if (!parent || !byId.has(parent) || seen.includes(parent)) break;
      current = parent;
    }
    for (const s of seen) rootCache.set(s, current);
    return current;
  }

  const plans = await prisma.mealPlan.findMany({
    where: { userId },
    select: { cookedAt: true, date: true, recipes: { select: { recipeId: true } } },
  });
  const lastCooked = new Map<string, Date>();
  for (const plan of plans) {
    const cooked = planCookedDate(plan, now);
    if (!cooked) continue;
    for (const mr of plan.recipes) {
      const root = rootOf(mr.recipeId);
      const prev = lastCooked.get(root);
      if (!prev || prev < cooked) lastCooked.set(root, cooked);
    }
  }

  const toFacts = (r: (typeof recipes)[number]): RecipeFacts => ({
    id: r.id,
    title: r.title,
    servings: r.servings,
    courses: r.courses.map((c) => c.courseType),
    diets: r.labels.filter((l) => l.label.type === 'dietary').map((l) => l.label.name),
    allergens: r.labels.filter((l) => l.label.type === 'allergen').map((l) => l.label.name),
    catalogIds: [...new Set(r.ingredients.map((i) => i.catalogId).filter((c): c is string => !!c))],
    lastCookedAt: lastCooked.get(rootOf(r.id)) ?? null,
  });

  const selection = selectedIds.map((id) => toFacts(byId.get(id)!));
  const selectedRoots = new Set(selectedIds.map(rootOf));
  const diets = query.diets ?? [];
  const freeFrom = query.freeFrom ?? [];

  const candidates = pool
    .filter((r) => !selectedRoots.has(rootOf(r.id)))
    .map(toFacts)
    .filter((c) => diets.every((d) => c.diets.includes(d)) && freeFrom.every((a) => !c.allergens.includes(a)));

  return scoreCandidates(selection, candidates, { now })
    .filter((s) => s.score > 0)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ recipe, score, reasons, breakdown }) => ({
      recipe: { id: recipe.id, title: recipe.title, servings: recipe.servings, courses: recipe.courses },
      score,
      reasons,
      breakdown,
    }));
}
