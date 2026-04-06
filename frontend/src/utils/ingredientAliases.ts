// Pairs of common ingredient alternative names.
// Each pair is [name, alias] — both directions are matched.
const ALIAS_PAIRS: [string, string][] = [
  ['green onion', 'scallion'],
  ['scallion', 'green onion'],
  ['cilantro', 'coriander'],
  ['coriander', 'cilantro'],
  ['eggplant', 'aubergine'],
  ['aubergine', 'eggplant'],
  ['zucchini', 'courgette'],
  ['courgette', 'zucchini'],
  ['arugula', 'rocket'],
  ['rocket', 'arugula'],
  ['chickpeas', 'garbanzo beans'],
  ['garbanzo beans', 'chickpeas'],
  ['chickpea', 'garbanzo bean'],
  ['garbanzo bean', 'chickpea'],
  ['heavy cream', 'double cream'],
  ['double cream', 'heavy cream'],
  ['cornstarch', 'cornflour'],
  ['cornflour', 'cornstarch'],
  ['baking soda', 'bicarbonate of soda'],
  ['bicarbonate of soda', 'baking soda'],
  ['ground beef', 'beef mince'],
  ['beef mince', 'ground beef'],
  ['shrimp', 'prawns'],
  ['prawns', 'shrimp'],
  ['bell pepper', 'capsicum'],
  ['capsicum', 'bell pepper'],
  ['snow peas', 'mangetout'],
  ['mangetout', 'snow peas'],
  ['half-and-half', 'single cream'],
  ['single cream', 'half-and-half'],
  ['broiler', 'grill'],
  ['spring onion', 'scallion'],
  ['scallion', 'spring onion'],
  ['golden raisins', 'sultanas'],
  ['sultanas', 'golden raisins'],
  ['confectioners sugar', 'icing sugar'],
  ["confectioners' sugar", 'icing sugar'],
  ['icing sugar', "confectioners' sugar"],
  ['powdered sugar', 'icing sugar'],
  ['icing sugar', 'powdered sugar'],
  ['rutabaga', 'swede'],
  ['swede', 'rutabaga'],
  ['semisweet chocolate', 'dark chocolate'],
  ['dark chocolate', 'semisweet chocolate'],
  ['all-purpose flour', 'plain flour'],
  ['plain flour', 'all-purpose flour'],
  ['whole wheat flour', 'wholemeal flour'],
  ['wholemeal flour', 'whole wheat flour'],
];

// Build a lookup map: normalized name → alias
const ALIAS_MAP = new Map<string, string>();
for (const [name, alias] of ALIAS_PAIRS) {
  // Avoid overwriting with a duplicate; first match wins
  if (!ALIAS_MAP.has(name.toLowerCase())) {
    ALIAS_MAP.set(name.toLowerCase(), alias);
  }
}

/**
 * Returns true if `haystack` contains `needle` as a whole-word substring.
 * E.g. "fresh cilantro leaves" contains "cilantro"; "onion" does NOT contain "green onion".
 */
function containsPhrase(haystack: string, needle: string): boolean {
  // Escape regex special chars in the needle
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match at word boundaries (handles multi-word phrases too)
  return new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i').test(haystack);
}

/**
 * Returns the alternative name for an ingredient if one is known, otherwise null.
 * Matching is case-insensitive and checks if the ingredient name contains a known term
 * as a whole-word match (e.g. "fresh cilantro" → "coriander").
 */
export function getIngredientAlias(name: string): string | null {
  const lower = name.toLowerCase().trim();
  // Exact match first
  if (ALIAS_MAP.has(lower)) return ALIAS_MAP.get(lower)!;
  // Check if the name contains a known term as a whole-word phrase
  for (const [key, alias] of ALIAS_MAP) {
    if (containsPhrase(lower, key)) {
      return alias;
    }
  }
  return null;
}
