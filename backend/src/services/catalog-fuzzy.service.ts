import { prisma } from '../db.js';
import { rankFuzzy } from '../utils/fuzzy.js';

const aliasInclude = { aliases: { orderBy: { alias: 'asc' as const } } };

/**
 * Fuzzy-match a query against the user's visible ingredient catalog (built-ins plus their own
 * entries), scoring each entry by its best display name or alias. Where the user's own entry
 * shadows a built-in of the same name, only the user's entry is returned.
 *
 * Results are suggestions/search hits only — callers must never feed them into dietary
 * auto-resolution (`dietary.service.ts`).
 */
export async function fuzzyCatalogMatches(userId: string, query: string, threshold: number) {
  const entries = await prisma.ingredientCatalog.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    include: aliasInclude,
  });
  const ownNames = new Set(entries.filter((e) => e.userId === userId).map((e) => e.displayAlias));
  const visible = entries.filter((e) => e.userId !== null || !ownNames.has(e.displayAlias));
  return rankFuzzy(query, visible, (e) => [e.displayAlias, ...e.aliases.map((a) => a.alias)], threshold);
}
