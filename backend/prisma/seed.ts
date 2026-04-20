import { config } from 'dotenv';
config();

import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { INGREDIENT_CATALOG } from '../src/constants/ingredientCatalog.js';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding ingredient catalog…');

  for (const [name, allergens, diets] of INGREDIENT_CATALOG) {
    await prisma.ingredientCatalog.upsert({
      where: { name },
      update: { allergens, diets },
      create: { name, allergens, diets, isUserAdded: false },
    });
  }

  console.log(`Seeded ${INGREDIENT_CATALOG.length} catalog entries.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
