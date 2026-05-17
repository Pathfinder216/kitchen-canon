import { config } from 'dotenv';
config();

import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { INGREDIENT_CATALOG } from '../src/constants/ingredientCatalog.js';
import { stemVariants } from '../src/utils/stemVariants.js';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Synonym groups. The first member found in INGREDIENT_CATALOG becomes the canonical entry;
// all other members (including any duplicate catalog entries) become aliases pointing to it.
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

const STANDARD_LABELS: { type: string; name: string }[] = [
  { type: 'manual', name: 'Make-ahead' },
  { type: 'manual', name: 'Freezable' },
  { type: 'manual', name: 'Quick' },
  { type: 'manual', name: 'Budget-friendly' },
];

async function main() {
  console.log('Seeding ingredient catalog…');

  // Full reseed — wipe existing catalog and aliases
  await prisma.ingredientAlias.deleteMany({});
  await prisma.ingredientCatalog.deleteMany({});

  const catalogNameSet = new Set(INGREDIENT_CATALOG.map(([name]) => name.toLowerCase()));

  // For each alias group, find the canonical name (first group member present in catalog)
  // and mark any other catalog members as secondaries to be merged.
  const aliasToCanonical = new Map<string, string>(); // any group alias → canonical catalog name
  const secondaryNames = new Set<string>();            // catalog entries to merge (not create)

  for (const group of ALIAS_GROUPS) {
    const lower = group.map((g) => g.toLowerCase());
    const primaryInCatalog = lower.find((m) => catalogNameSet.has(m));
    if (!primaryInCatalog) continue; // no catalog entry for this group — skip

    for (const member of lower) {
      aliasToCanonical.set(member, primaryInCatalog);
      if (member !== primaryInCatalog && catalogNameSet.has(member)) {
        secondaryNames.add(member);
      }
    }
  }

  // Create catalog entries (skip secondary names — they become aliases of their canonical)
  const catalogIds = new Map<string, string>(); // canonical name → catalog ID

  for (const [name, allergens, diets] of INGREDIENT_CATALOG) {
    const lower = name.toLowerCase();
    if (secondaryNames.has(lower)) continue;

    const entry = await prisma.ingredientCatalog.create({
      data: { displayAlias: lower, allergens, diets, isUserAdded: false },
    });
    catalogIds.set(lower, entry.id);
  }

  // Build the full set of aliases for each catalog entry.
  // Each entry gets: its own name + stem variants, secondary names + their stem variants,
  // and all alias group members + their stem variants.
  const entryAliases = new Map<string, Set<string>>(); // canonical name → alias strings
  for (const canonicalName of catalogIds.keys()) {
    entryAliases.set(canonicalName, new Set(stemVariants(canonicalName)));
  }

  // Add secondary catalog entries (merged into their canonical)
  for (const secondary of secondaryNames) {
    const canonical = aliasToCanonical.get(secondary)!;
    const aliases = entryAliases.get(canonical);
    if (!aliases) continue;
    for (const v of stemVariants(secondary)) aliases.add(v);
  }

  // Add all alias group members (including non-catalog ones like "scallion", "aubergine", etc.)
  for (const group of ALIAS_GROUPS) {
    const lower = group.map((g) => g.toLowerCase());
    const canonical = lower.find((m) => catalogIds.has(m));
    if (!canonical) continue;
    const aliases = entryAliases.get(canonical)!;
    for (const member of lower) {
      for (const v of stemVariants(member)) aliases.add(v);
    }
  }

  // Insert alias records
  for (const [canonical, aliases] of entryAliases) {
    const catalogId = catalogIds.get(canonical)!;
    for (const alias of aliases) {
      await prisma.ingredientAlias.upsert({
        where: { alias },
        update: {},
        create: { alias, catalogId },
      });
    }
  }

  console.log(`Seeded ${catalogIds.size} catalog entries.`);

  // Migrate old label types and seed standard labels
  await prisma.label.updateMany({
    where: { type: { in: ['makeAhead', 'equipment'] } },
    data: { type: 'manual' },
  });

  console.log('Seeding standard labels…');
  for (const { type, name } of STANDARD_LABELS) {
    await prisma.label.upsert({
      where: { type_name: { type, name } },
      update: {},
      create: { type, name },
    });
  }
  console.log(`Seeded ${STANDARD_LABELS.length} standard labels.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
