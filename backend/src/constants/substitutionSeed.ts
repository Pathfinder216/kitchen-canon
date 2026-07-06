// Curated set of well-established, app-official ingredient substitutions.
//
// Semantics (see substitutions.service.ts + the recipe-detail swap UI): a row swaps the recipe
// ingredient `from` for `to`, and the displayed amount is multiplied by `ratio`. So a fresh→dried
// herb row at ratio 0.333 turns "1 cup fresh basil" into "1/3 cup dried basil".
//
// Names are lowercase and match the ingredient catalog's displayAlias where a catalog entry exists
// (see ingredientCatalog.ts). Combination substitutes (e.g. "baking soda + cream of tartar") are
// stored as a single descriptive `to` string with the split spelled out in `notes`; their `ratio`
// reflects the combined final volume.

export interface SubstitutionSeed {
  from: string;
  to: string;
  ratio: number;
  notes: string;
}

export const SUBSTITUTION_SEED: SubstitutionSeed[] = [
  // ── Baking ──────────────────────────────────────────────────────────────────
  {
    from: 'buttermilk',
    to: 'milk + lemon juice',
    ratio: 1,
    notes: 'Add 1 tbsp lemon juice (or vinegar) per cup of milk and rest 5 minutes.',
  },
  {
    from: 'cake flour',
    to: 'all-purpose flour',
    ratio: 0.875,
    notes: 'Use 1 cup minus 2 tbsp all-purpose flour per cup of cake flour.',
  },
  {
    from: 'baking powder',
    to: 'baking soda + cream of tartar',
    ratio: 0.75,
    notes: 'Per 1 tsp baking powder use 1/4 tsp baking soda + 1/2 tsp cream of tartar.',
  },
  {
    from: 'butter',
    to: 'coconut oil',
    ratio: 1,
    notes: '1:1 by volume.',
  },
  {
    from: 'egg',
    to: 'ground flaxseed + water',
    ratio: 1,
    notes: 'Vegan; best in baking. Per egg use 1 tbsp ground flaxseed + 3 tbsp water; rest 5 min.',
  },
  {
    from: 'egg',
    to: 'applesauce',
    ratio: 1,
    notes: 'Adds sweetness; use 1/4 cup unsweetened applesauce per egg.',
  },

  // ── Fresh → dried herbs (dried is more concentrated: use one-third) ──────────
  {
    from: 'basil',
    to: 'dried basil',
    ratio: 0.333,
    notes: 'Dried herbs are more concentrated; use one-third as much.',
  },
  {
    from: 'oregano',
    to: 'dried oregano',
    ratio: 0.333,
    notes: 'Dried herbs are more concentrated; use one-third as much.',
  },
  {
    from: 'thyme',
    to: 'dried thyme',
    ratio: 0.333,
    notes: 'Dried herbs are more concentrated; use one-third as much.',
  },
  {
    from: 'rosemary',
    to: 'dried rosemary',
    ratio: 0.333,
    notes: 'Dried herbs are more concentrated; use one-third as much.',
  },
  {
    from: 'parsley',
    to: 'dried parsley',
    ratio: 0.333,
    notes: 'Dried herbs are more concentrated; use one-third as much.',
  },

  // ── Dairy ───────────────────────────────────────────────────────────────────
  {
    from: 'heavy cream',
    to: 'evaporated milk',
    ratio: 1,
    notes: "Won't whip.",
  },
  {
    from: 'sour cream',
    to: 'greek yogurt',
    ratio: 1,
    notes: '1:1 by volume.',
  },
  {
    from: 'milk',
    to: 'oat milk',
    ratio: 1,
    notes: 'Vegan.',
  },

  // ── Pantry ──────────────────────────────────────────────────────────────────
  {
    from: 'cornstarch',
    to: 'all-purpose flour',
    ratio: 2,
    notes: 'For thickening, use twice as much flour.',
  },
  {
    from: 'fresh garlic',
    to: 'garlic powder',
    ratio: 0.125,
    notes: '1 clove ≈ 1/8 tsp garlic powder.',
  },
  {
    from: 'fresh ginger',
    to: 'ground ginger',
    ratio: 0.083,
    notes: '1 tbsp grated fresh ginger ≈ 1/4 tsp ground ginger.',
  },
  {
    from: 'lemon juice',
    to: 'vinegar',
    ratio: 1,
    notes: '1:1 by volume; white or cider vinegar works.',
  },
  {
    from: 'tomato sauce',
    to: 'tomato paste + water',
    ratio: 1,
    notes: '1 cup tomato sauce = 3/4 cup tomato paste + 1/4 cup water.',
  },
  {
    from: 'wine',
    to: 'broth',
    ratio: 1,
    notes: 'Non-alcoholic; use a broth that matches the dish.',
  },
  {
    from: 'honey',
    to: 'maple syrup',
    ratio: 1,
    notes: '1:1 by volume.',
  },

  // ── Additional uncontroversial pairs ────────────────────────────────────────
  {
    from: 'butter',
    to: 'margarine',
    ratio: 1,
    notes: '1:1 by volume.',
  },
  {
    from: 'vegetable oil',
    to: 'canola oil',
    ratio: 1,
    notes: '1:1; both neutral oils.',
  },
  {
    from: 'canola oil',
    to: 'vegetable oil',
    ratio: 1,
    notes: '1:1; both neutral oils.',
  },
  {
    from: 'milk',
    to: 'almond milk',
    ratio: 1,
    notes: 'Vegan.',
  },
  {
    from: 'milk',
    to: 'soy milk',
    ratio: 1,
    notes: 'Vegan.',
  },
  {
    from: 'heavy cream',
    to: 'coconut cream',
    ratio: 1,
    notes: "Vegan; won't whip.",
  },
  {
    from: 'mayonnaise',
    to: 'greek yogurt',
    ratio: 1,
    notes: 'Lighter and tangier.',
  },
  {
    from: 'greek yogurt',
    to: 'sour cream',
    ratio: 1,
    notes: '1:1 by volume.',
  },
  {
    from: 'brown sugar',
    to: 'sugar',
    ratio: 1,
    notes: 'Add 1 tbsp molasses per cup for the flavor and moisture brown sugar provides.',
  },
  {
    from: 'sugar',
    to: 'brown sugar',
    ratio: 1,
    notes: 'Adds mild molasses flavor and moisture.',
  },
  {
    from: 'all-purpose flour',
    to: 'whole wheat flour',
    ratio: 1,
    notes: 'Denser, nuttier result.',
  },
  {
    from: 'bread flour',
    to: 'all-purpose flour',
    ratio: 1,
    notes: 'Slightly less chew.',
  },
  {
    from: 'soy sauce',
    to: 'tamari',
    ratio: 1,
    notes: 'Gluten-free.',
  },
  {
    from: 'tamari',
    to: 'soy sauce',
    ratio: 1,
    notes: '1:1 by volume.',
  },
  {
    from: 'balsamic vinegar',
    to: 'red wine vinegar',
    ratio: 1,
    notes: 'Less sweet; add a pinch of sugar if desired.',
  },
  {
    from: 'red wine vinegar',
    to: 'apple cider vinegar',
    ratio: 1,
    notes: '1:1 by volume.',
  },
  {
    from: 'dijon mustard',
    to: 'mustard',
    ratio: 1,
    notes: 'Yellow mustard is milder.',
  },
  {
    from: 'shallot',
    to: 'onion',
    ratio: 1,
    notes: 'Milder flavor; use a bit less if the onion is strong.',
  },
  {
    from: 'honey',
    to: 'agave',
    ratio: 1,
    notes: 'Vegan.',
  },
  {
    from: 'lime juice',
    to: 'lemon juice',
    ratio: 1,
    notes: '1:1 by volume.',
  },
  {
    from: 'lemon juice',
    to: 'lime juice',
    ratio: 1,
    notes: '1:1 by volume.',
  },
  {
    from: 'chicken broth',
    to: 'vegetable broth',
    ratio: 1,
    notes: 'Vegetarian.',
  },
];
