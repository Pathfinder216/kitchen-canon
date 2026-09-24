/**
 * Typo-tolerant string similarity for short food names and recipe titles.
 *
 * Scores are in [0, 1]. They are only ever used for search/filter results and "Did you mean …?"
 * suggestions — never for dietary/allergen auto-resolution, which stays exact → alias → stem.
 */

/** Typeahead: fuzzy catalog matches appended when the substring prefilter finds few results. */
export const TYPEAHEAD_THRESHOLD = 0.75;
/** Recipe-list ingredient filters: a term with no exact/alias hit resolves to its best match. */
export const FILTER_THRESHOLD = 0.8;
/** Recipe title search, used only when the substring search finds nothing. */
export const TITLE_THRESHOLD = 0.7;
/** "Did you mean …?" suggestions — the user confirms, so this can be looser. */
export const SUGGEST_THRESHOLD = 0.5;

/** Lowercase, drop diacritics and apostrophes, turn other punctuation into spaces, collapse whitespace. */
export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Character bigrams of each word, padded with a space on both sides so word starts and ends
 * count (this is what keeps `salt` from matching `basalt`). Returned as a multiset.
 */
function bigrams(normalized: string): Map<string, number> {
  const grams = new Map<string, number>();
  for (const word of normalized.split(' ')) {
    if (!word) continue;
    const padded = ` ${word} `;
    for (let i = 0; i < padded.length - 1; i++) {
      const g = padded.slice(i, i + 2);
      grams.set(g, (grams.get(g) ?? 0) + 1);
    }
  }
  return grams;
}

function diceOfGrams(a: Map<string, number>, b: Map<string, number>): number {
  let sizeA = 0;
  let sizeB = 0;
  let overlap = 0;
  for (const n of a.values()) sizeA += n;
  for (const n of b.values()) sizeB += n;
  if (sizeA === 0 || sizeB === 0) return 0;
  for (const [g, n] of a) overlap += Math.min(n, b.get(g) ?? 0);
  return (2 * overlap) / (sizeA + sizeB);
}

/** Sørensen–Dice coefficient over (word-padded) character bigrams of the normalized strings. */
export function diceSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return diceOfGrams(bigrams(na), bigrams(nb));
}

/**
 * Similarity of a user query to a candidate name: the max of
 *  - dice over the whole strings, and
 *  - token-set overlap: each query word's best dice against any candidate word, averaged over
 *    the query words (so `chiken` ≈ `chicken breast`, but `red chiken` ≉ `red pepper`).
 */
export function fuzzyScore(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;

  const whole = diceOfGrams(bigrams(q), bigrams(c));

  const cTokens = c.split(' ').map(bigrams);
  const qTokens = q.split(' ');
  let tokenSum = 0;
  for (const qt of qTokens) {
    const qg = bigrams(qt);
    let best = 0;
    for (const cg of cTokens) best = Math.max(best, diceOfGrams(qg, cg));
    tokenSum += best;
  }
  const token = tokenSum / qTokens.length;

  return Math.max(whole, token);
}

export interface FuzzyMatch<T> {
  item: T;
  score: number;
}

/**
 * Score each item by the best `fuzzyScore` over its names, keep those at or above `threshold`,
 * and sort best-first. Ties go to the item whose best name is closer as a whole string (so
 * `tomatos` prefers `tomatoes` over `cherry tomatoes`), then to the shorter name.
 */
export function rankFuzzy<T>(
  query: string,
  items: T[],
  namesOf: (item: T) => string[],
  threshold: number,
): FuzzyMatch<T>[] {
  const scored: (FuzzyMatch<T> & { whole: number; len: number })[] = [];
  for (const item of items) {
    let score = 0;
    let whole = 0;
    let len = Infinity;
    for (const name of namesOf(item)) {
      const s = fuzzyScore(query, name);
      const w = diceSimilarity(query, name);
      if (s > score || (s === score && (w > whole || (w === whole && name.length < len)))) {
        score = s;
        whole = w;
        len = name.length;
      }
    }
    if (score >= threshold) scored.push({ item, score, whole, len });
  }
  scored.sort((a, b) => b.score - a.score || b.whole - a.whole || a.len - b.len);
  return scored.map(({ item, score }) => ({ item, score }));
}
