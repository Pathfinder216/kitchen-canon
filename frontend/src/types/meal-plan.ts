export interface GroceryItem {
  id: string;
  mealPlanId: string;
  ingredient: string;
  amount: number | null;
  unit: string | null;
  purchased: boolean;
  /** Grocery aisle resolved at read time from the catalog (user overrides first); absent/unknown
   *  values are grouped under "Other". */
  aisle?: string;
}

export type ActiveSwaps = Record<string, { toIngredient: string; ratio: number }>;

export interface MealRecipeSummary {
  id: string;
  mealPlanId: string;
  recipeId: string;
  recipeVersion: number;
  servings: number;
  orderIndex: number;
  substitutions: ActiveSwaps | null;
  recipe: {
    id: string;
    title: string;
    servings: number;
  };
}

export interface MealPlanSummary {
  id: string;
  name: string | null;
  date: string | null;
  time: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  recipes: MealRecipeSummary[];
}

export interface MealRecipeDetail extends MealRecipeSummary {
  recipe: {
    id: string;
    title: string;
    servings: number;
    totalTime: number | null;
    activeTime: number | null;
    ingredients: {
      id: string;
      name: string;
      amount: number | null;
      unit: string | null;
      isOptional: boolean;
      orderIndex: number;
    }[];
    steps: {
      id: string;
      orderIndex: number;
      instruction: string;
      timeMinutes: number | null;
      isActiveTime: boolean;
    }[];
  };
}

export interface DietaryInfo {
  allergens: string[];
  diets: string[];
  unknownIngredients: string[];
}

export interface MealPlanDetail {
  id: string;
  name: string | null;
  date: string | null;
  time: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  dietaryInfo: DietaryInfo | null;
  recipes: MealRecipeDetail[];
  groceryList: GroceryItem[];
}

export interface CreateMealPlanInput {
  name: string;
  date?: string;
  time?: string;
  notes?: string;
  recipes: {
    recipeId: string;
    servings: number;
    orderIndex?: number;
    substitutions?: ActiveSwaps;
  }[];
}

// ── Cooking timeline (GET /meal-plans/:id/timeline) ─────────────────────────
// Dates are ISO strings. `itemId` is the MealRecipe id (a plan may include a recipe twice).

export interface TimelineEntry {
  itemId: string;
  recipeId: string;
  stepId: string;
  stepIndex: number;
  start: string;
  end: string;
  isActive: boolean;
  untimed: boolean;
  label: string;
}

export interface TimelineRecipeSummary {
  itemId: string;
  recipeId: string;
  title: string;
  start: string | null;
  end: string | null;
}

export interface TimelineWarning {
  type: 'untimed-steps' | 'no-steps';
  itemId: string;
  recipeId: string;
  stepIds: string[];
  message: string;
}

export interface MakeAheadSuggestion {
  itemId: string;
  recipeId: string;
  stepId: string | null;
  reason: 'long-passive-step' | 'early-start';
  leadMinutes: number;
  startBy: string;
  message: string;
}

export interface CookingTimeline {
  serveAt: string;
  start: string;
  entries: TimelineEntry[];
  recipes: TimelineRecipeSummary[];
  warnings: TimelineWarning[];
  makeAhead: MakeAheadSuggestion[];
}

export interface UpdateMealPlanInput {
  name?: string;
  date?: string | null;
  time?: string | null;
  notes?: string | null;
  recipes?: {
    recipeId: string;
    servings: number;
    orderIndex?: number;
    substitutions?: ActiveSwaps;
  }[];
}

/** One rule's contribution to a suggestion's score (GET /meal-plans/suggestions). */
export interface SuggestionScoreComponent {
  rule: 'course-complement' | 'course-redundancy' | 'diet' | 'allergen' | 'overlap' | 'novelty';
  points: number;
  reason: string;
}

/** A recipe that complements the current meal-plan selection, with the reasons it was picked. */
export interface MealPlanSuggestion {
  recipe: { id: string; title: string; servings: number; courses: string[] };
  score: number;
  /** Human-readable reasons for the positive contributions ("fills side course", …). */
  reasons: string[];
  breakdown: SuggestionScoreComponent[];
}

/** Dietary filter applied to suggestion candidates (comma-separated, same shape as the recipe list). */
export interface SuggestionFilters {
  diets?: string;
  freeFrom?: string;
}
