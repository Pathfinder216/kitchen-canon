/**
 * Restore user data from data/backup.json after a schema-breaking migration.
 * Run with: npm run db:restore
 * Must be run AFTER prisma db push --force-reset AND npm run db:seed.
 */

import { config } from 'dotenv';
config();

import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { stemVariants } from '../src/utils/stemVariants.js';
import fs from 'fs';
import path from 'path';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter }) as any;

async function main() {
  const backupPath = path.join(process.cwd(), 'data', 'backup.json');
  if (!fs.existsSync(backupPath)) {
    console.error('No data/backup.json found. Run npm run db:backup first.');
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = JSON.parse(fs.readFileSync(backupPath, 'utf-8')) as Record<string, any[]> & { exportedAt: string };
  console.log(`Restoring backup from ${b.exportedAt}…`);

  // 1. Labels — upsert by (type, name); build an ID map for RecipeLabel remapping.
  console.log('Restoring labels…');
  const labelIdMap = new Map<string, string>(); // old ID → new ID
  for (const label of b.labels) {
    const newLabel = await prisma.label.upsert({
      where: { type_name: { type: label.type, name: label.name } },
      update: {},
      create: { type: label.type, name: label.name },
    });
    labelIdMap.set(label.id, newLabel.id);
  }

  // 2. Recipes — create root recipes first (parentId = null), then children.
  console.log(`Restoring ${b.recipes.length} recipes…`);
  const sorted = [
    ...b.recipes.filter((r: any) => !r.parentId),
    ...b.recipes.filter((r: any) => !!r.parentId),
  ];
  for (const recipe of sorted) {
    await prisma.recipe.create({ data: recipe });
  }

  // 3. Recipe relations — bulk insert in dependency order.
  if (b.steps.length)      await prisma.step.createMany({ data: b.steps });
  if (b.ingredients.length) await prisma.ingredient.createMany({ data: b.ingredients });
  if (b.media.length)      await prisma.media.createMany({ data: b.media });
  if (b.recipeCourses.length) await prisma.recipeCourse.createMany({ data: b.recipeCourses });

  if (b.recipeLabels.length) {
    await prisma.recipeLabel.createMany({
      data: b.recipeLabels.map((rl: any) => ({
        recipeId: rl.recipeId,
        labelId: labelIdMap.get(rl.labelId) ?? rl.labelId,
      })),
    });
  }

  // 4. Ingredient substitutions.
  if (b.ingredientSubstitutions.length) {
    await prisma.ingredientSubstitution.createMany({ data: b.ingredientSubstitutions });
  }

  // 5. Meal plans and their relations.
  console.log(`Restoring ${b.mealPlans.length} meal plans…`);
  for (const plan of b.mealPlans) {
    await prisma.mealPlan.create({ data: plan });
  }
  if (b.mealRecipes.length)  await prisma.mealRecipe.createMany({ data: b.mealRecipes });
  if (b.groceryItems.length) await prisma.groceryItem.createMany({ data: b.groceryItems });

  // 6. Misc tables.
  if (b.localizationMappings.length) {
    await prisma.localizationMapping.createMany({ data: b.localizationMappings });
  }
  if (b.userPreferences.length) {
    await prisma.userPreferences.createMany({ data: b.userPreferences });
  }

  // 7. Ingredient catalog.
  //    - Seeded entries: restore allergen/diet edits the user made before the migration.
  //    - User-added entries: create fresh with the new schema (displayAlias + alias records).
  console.log(`Restoring catalog edits and user-added entries…`);
  for (const entry of b.ingredientCatalog) {
    const lower = (entry.name as string).toLowerCase().trim();

    if (entry.isUserAdded) {
      const existingAlias = await prisma.ingredientAlias.findUnique({ where: { alias: lower } });
      if (!existingAlias) {
        const newEntry = await prisma.ingredientCatalog.create({
          data: { displayAlias: lower, allergens: entry.allergens, diets: entry.diets, isUserAdded: true },
        });
        const variants = [...new Set(stemVariants(lower))];
        for (const alias of variants) {
          await prisma.ingredientAlias.upsert({
            where: { alias },
            update: {},
            create: { alias, catalogId: newEntry.id },
          });
        }
      }
    } else {
      // Update allergens/diets if the user had edited this seeded entry.
      const existingAlias = await prisma.ingredientAlias.findUnique({
        where: { alias: lower },
        include: { catalog: true },
      });
      if (existingAlias) {
        const sameA = JSON.stringify([...(existingAlias.catalog.allergens as string[])].sort()) ===
                      JSON.stringify([...(entry.allergens as string[])].sort());
        const sameD = JSON.stringify([...(existingAlias.catalog.diets as string[])].sort()) ===
                      JSON.stringify([...(entry.diets as string[])].sort());
        if (!sameA || !sameD) {
          await prisma.ingredientCatalog.update({
            where: { id: existingAlias.catalogId },
            data: { allergens: entry.allergens, diets: entry.diets },
          });
          console.log(`  Updated allergens/diets for "${lower}" (user-edited seeded entry)`);
        }
      }
    }
  }

  console.log('Restore complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
