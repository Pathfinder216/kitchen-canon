import type { Prisma } from '@prisma/client';

type RecipeWithRelations = Prisma.RecipeGetPayload<{
  include: {
    ingredients: { orderBy: { orderIndex: 'asc' } };
    steps: { orderBy: { orderIndex: 'asc' } };
    labels: { include: { label: true } };
    courses: true;
  };
}>;

function formatAmount(amount: number | null, unit: string | null): string {
  if (amount === null) return '';
  const n = Number.isInteger(amount) ? amount.toString() : amount.toFixed(2).replace(/\.?0+$/, '');
  return unit ? `${n} ${unit}` : n;
}

const REF_PATTERN = /\{([^}:]+)(?::(\d+(?:\.\d+)?)%)?\}/g;

function resolveRefs(instruction: string, ingredients: RecipeWithRelations['ingredients']): string {
  const totals = new Map<string, number>();
  for (const ing of ingredients) totals.set(ing.name, (totals.get(ing.name) ?? 0) + 1);
  const ranks = new Map<string, number>();
  const byKey = new Map<string, (typeof ingredients)[number]>();
  for (const ing of ingredients) {
    const rank = (ranks.get(ing.name) ?? 0) + 1;
    ranks.set(ing.name, rank);
    const key = (totals.get(ing.name) ?? 1) === 1 ? ing.name : `${ing.name} ${rank}`;
    byKey.set(key, ing);
  }
  return instruction.replace(REF_PATTERN, (_full, internalId, pctStr) => {
    const ing = byKey.get(internalId);
    if (!ing) return _full;
    const pct = (pctStr !== undefined ? parseFloat(pctStr) : 100) / 100;
    const scaledAmount = ing.amount !== null ? ing.amount * pct : null;
    const parts = [formatAmount(scaledAmount, ing.unit), ing.name].filter(Boolean);
    return parts.join(' ');
  });
}

export function recipeToText(recipe: RecipeWithRelations): string {
  const lines: string[] = [];

  lines.push(recipe.title);
  lines.push('='.repeat(recipe.title.length));
  lines.push('');

  const totalTime = Math.ceil(recipe.steps.reduce((sum, s) => sum + (s.timeMinutes ?? 0), 0));
  const activeTime = Math.ceil(recipe.steps.filter(s => s.isActiveTime).reduce((sum, s) => sum + (s.timeMinutes ?? 0), 0));
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
      lines.push(`${step.orderIndex + 1}. ${resolveRefs(step.instruction, recipe.ingredients)}${time}`);
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
      instruction: resolveRefs(step.instruction, recipe.ingredients),
      timeMinutes: step.timeMinutes,
      isActiveTime: step.isActiveTime,
    })),
    labels: recipe.labels.map((rl) => rl.label.name),
    courses: recipe.courses.map((rc) => rc.courseType),
    exportedAt: new Date().toISOString(),
  };
}
