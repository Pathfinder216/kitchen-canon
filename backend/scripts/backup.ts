/**
 * Export all user data to data/backup.json before a schema-breaking migration.
 * Run with: npm run db:backup
 * Must be run BEFORE prisma db push --force-reset.
 */

import { config } from 'dotenv';
config();

import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import fs from 'fs';
import path from 'path';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Exporting database…');

  const backup = {
    exportedAt: new Date().toISOString(),
    labels: await prisma.label.findMany(),
    recipes: await prisma.recipe.findMany(),
    ingredients: await prisma.ingredient.findMany(),
    steps: await prisma.step.findMany(),
    media: await prisma.media.findMany(),
    recipeCourses: await prisma.recipeCourse.findMany(),
    recipeLabels: await prisma.recipeLabel.findMany(),
    ingredientSubstitutions: await prisma.ingredientSubstitution.findMany(),
    mealPlans: await prisma.mealPlan.findMany(),
    mealRecipes: await prisma.mealRecipe.findMany(),
    groceryItems: await prisma.groceryItem.findMany(),
    ingredientCatalog: await prisma.ingredientCatalog.findMany(),
    localizationMappings: await prisma.localizationMapping.findMany(),
    userPreferences: await prisma.userPreferences.findMany(),
  };

  const outPath = path.join(process.cwd(), 'data', 'backup.json');
  fs.writeFileSync(outPath, JSON.stringify(backup, null, 2));

  console.log(`Backup saved to ${outPath}`);
  console.log(`  recipes:          ${backup.recipes.length}`);
  console.log(`  meal plans:       ${backup.mealPlans.length}`);
  console.log(`  labels:           ${backup.labels.length}`);
  console.log(`  catalog entries:  ${backup.ingredientCatalog.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
