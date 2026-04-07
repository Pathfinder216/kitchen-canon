/**
 * Groups of ingredient names that are considered equivalent.
 * Each group member is a valid way to refer to the same ingredient.
 */
const ALIAS_GROUPS: string[][] = [
  ['green onion', 'scallion', 'spring onion'],
  ['cilantro', 'coriander'],
  ['eggplant', 'aubergine'],
  ['zucchini', 'courgette'],
  ['arugula', 'rocket'],
  ['chickpea', 'garbanzo bean'],
  ['heavy cream', 'double cream'],
  ['cornstarch', 'cornflour'],
  ['baking soda', 'bicarbonate of soda'],
  ['ground beef', 'beef mince'],
  ['shrimp', 'prawn'],
  ['bell pepper', 'capsicum'],
  ['snow pea', 'mangetout'],
  ['half-and-half', 'single cream'],
  ['golden raisin', 'sultana'],
  ["confectioners' sugar", 'icing sugar', 'powdered sugar'],
  ['rutabaga', 'swede'],
  ['semisweet chocolate', 'semi-sweet chocolate', 'dark chocolate'],
  ['all-purpose flour', 'plain flour'],
  ['whole wheat flour', 'wholemeal flour'],
];

// Map each lowercase name to its group
const NAME_TO_GROUP = new Map<string, string[]>();
for (const group of ALIAS_GROUPS) {
  for (const name of group) {
    NAME_TO_GROUP.set(name.toLowerCase(), group);
  }
}

/**
 * Returns all alias group members for a given ingredient name,
 * or just the name itself if it has no known aliases.
 * All returned values are lowercase.
 */
export function getAliasGroup(name: string): string[] {
  const lower = name.toLowerCase().trim();
  // Exact match
  if (NAME_TO_GROUP.has(lower)) {
    return NAME_TO_GROUP.get(lower)!.map((n) => n.toLowerCase());
  }
  // Substring match: e.g. "fresh cilantro" contains "cilantro"
  for (const [key, group] of NAME_TO_GROUP) {
    if (containsWholePhrase(lower, key)) {
      return group.map((n) => n.toLowerCase());
    }
  }
  return [lower];
}

/** True if haystack contains needle as a whole-word phrase. */
function containsWholePhrase(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i').test(haystack);
}
