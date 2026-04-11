export interface GroceryItem {
  id: string;
  mealPlanId: string;
  ingredient: string;
  amount: number | null;
  unit: string | null;
  purchased: boolean;
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

export interface MealPlanDetail {
  id: string;
  name: string | null;
  date: string | null;
  time: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
