export const ALLERGENS = [
  'dairy', 'eggs', 'gluten', 'peanuts', 'tree_nuts', 'soy', 'fish', 'shellfish', 'sesame',
] as const;

export const DIETS = [
  'vegan', 'vegetarian', 'pescatarian', 'gluten_free', 'dairy_free', 'nut_free',
] as const;

export type Allergen = (typeof ALLERGENS)[number];
export type Diet = (typeof DIETS)[number];

export const ALLERGEN_LABELS: Record<string, string> = {
  dairy: 'Dairy', eggs: 'Eggs', gluten: 'Gluten', peanuts: 'Peanuts',
  tree_nuts: 'Tree Nuts', soy: 'Soy', fish: 'Fish', shellfish: 'Shellfish', sesame: 'Sesame',
};

export const DIET_LABELS: Record<string, string> = {
  vegan: 'Vegan', vegetarian: 'Vegetarian', pescatarian: 'Pescatarian',
  gluten_free: 'Gluten-Free', dairy_free: 'Dairy-Free', nut_free: 'Nut-Free',
};
