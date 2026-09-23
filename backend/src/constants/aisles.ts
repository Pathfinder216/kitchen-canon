// Grocery aisle vocabulary. Fixed, enum-like — not a table. Array order is the display/sort order
// of grocery-list sections; `household-other` is the fallback for unresolved items and sorts last.

export const AISLES = [
  'produce',
  'meat-seafood',
  'dairy-eggs',
  'deli',
  'bakery',
  'frozen',
  'canned-jarred',
  'dry-pasta-grains',
  'baking-spices',
  'condiments-oils',
  'snacks',
  'beverages',
  'household-other',
] as const;

export type Aisle = (typeof AISLES)[number];

export const DEFAULT_AISLE: Aisle = 'household-other';

export const AISLE_LABELS: Record<Aisle, string> = {
  produce: 'Produce',
  'meat-seafood': 'Meat & Seafood',
  'dairy-eggs': 'Dairy & Eggs',
  deli: 'Deli',
  bakery: 'Bakery',
  frozen: 'Frozen',
  'canned-jarred': 'Canned & Jarred',
  'dry-pasta-grains': 'Pasta, Rice & Grains',
  'baking-spices': 'Baking & Spices',
  'condiments-oils': 'Condiments & Oils',
  snacks: 'Snacks & Nuts',
  beverages: 'Beverages',
  'household-other': 'Other',
};

export function isAisle(value: unknown): value is Aisle {
  return typeof value === 'string' && (AISLES as readonly string[]).includes(value);
}
