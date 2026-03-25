import type { Prisma } from '@prisma/client';

type RecipeWithRelations = Prisma.RecipeGetPayload<{
  include: {
    ingredients: { orderBy: { orderIndex: 'asc' } };
    steps: { orderBy: { orderIndex: 'asc' } };
    labels: { include: { label: true } };
    categories: { include: { category: true } };
  };
}>;

function formatAmount(amount: number | null, unit: string | null): string {
  if (amount === null) return '';
  const n = Number.isInteger(amount) ? amount.toString() : amount.toFixed(2).replace(/\.?0+$/, '');
  return unit ? `${n} ${unit}` : n;
}

export function recipeToText(recipe: RecipeWithRelations): string {
  const lines: string[] = [];

  lines.push(recipe.title);
  lines.push('='.repeat(recipe.title.length));
  lines.push('');

  const totalTime = recipe.steps.reduce((sum, s) => sum + (s.timeMinutes ?? 0), 0);
  const activeTime = recipe.steps.filter(s => s.isActiveTime).reduce((sum, s) => sum + (s.timeMinutes ?? 0), 0);
  const meta: string[] = [];
  if (recipe.servings) meta.push(`Serves: ${recipe.servings}`);
  if (totalTime) meta.push(`Total time: ${totalTime} min`);
  if (activeTime) meta.push(`Active time: ${activeTime} min`);
  if (recipe.source) meta.push(`Source: ${recipe.source}`);
  if (meta.length) { lines.push(meta.join(' | ')); lines.push(''); }

  if (recipe.authorNotes) {
    lines.push('Notes:', recipe.authorNotes, '');
  }

  if (recipe.ingredients.length) {
    lines.push('Ingredients');
    lines.push('-----------');
    for (const ing of recipe.ingredients) {
      const amt = formatAmount(ing.amount, ing.unit);
      const optional = ing.isOptional ? ' (optional)' : '';
      lines.push(`- ${amt ? amt + ' ' : ''}${ing.name}${optional}`);
    }
    lines.push('');
  }

  if (recipe.steps.length) {
    lines.push('Instructions');
    lines.push('------------');
    for (const step of recipe.steps) {
      const time = step.timeMinutes ? ` [${step.timeMinutes} min]` : '';
      lines.push(`${step.orderIndex + 1}. ${step.instruction}${time}`);
    }
    lines.push('');
  }

  if (recipe.personalNotes) {
    lines.push('Personal Notes:', recipe.personalNotes, '');
  }

  lines.push(`v${recipe.version} · Exported from Let Them Cook`);
  return lines.join('\n');
}

export function recipeToJson(recipe: RecipeWithRelations): object {
  const exportTotalTime = recipe.steps.reduce((sum, s) => sum + (s.timeMinutes ?? 0), 0) || null;
  const exportActiveTime = recipe.steps.filter(s => s.isActiveTime).reduce((sum, s) => sum + (s.timeMinutes ?? 0), 0) || null;
  return {
    title: recipe.title,
    servings: recipe.servings,
    totalTime: exportTotalTime,
    activeTime: exportActiveTime,
    source: recipe.source,
    authorNotes: recipe.authorNotes,
    personalNotes: recipe.personalNotes,
    version: recipe.version,
    ingredients: recipe.ingredients.map((ing) => ({
      name: ing.name,
      originalName: ing.originalName,
      amount: ing.amount,
      unit: ing.unit,
      isOptional: ing.isOptional,
      orderIndex: ing.orderIndex,
    })),
    steps: recipe.steps.map((step) => ({
      orderIndex: step.orderIndex,
      instruction: step.instruction,
      timeMinutes: step.timeMinutes,
      isActiveTime: step.isActiveTime,
    })),
    labels: recipe.labels.map((rl) => rl.label.name),
    categories: recipe.categories.map((rc) => rc.category.name),
    exportedAt: new Date().toISOString(),
  };
}
