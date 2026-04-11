import type { Recipe, Ingredient } from '../types/recipe';
import { formatScaledAmount } from '../hooks/useScaling';
import { resolveIngredientRefsText } from './resolveIngredientRefs';

function safeName(title: string): string {
  return title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportRecipeAsText(
  recipe: Recipe,
  finalIngredients: Ingredient[],
  swapDisplayNames: Map<string, string>,
  targetServings: number,
) {
  const lines: string[] = [];

  lines.push(recipe.title);
  lines.push('='.repeat(recipe.title.length));
  lines.push('');

  const meta: string[] = [];
  if (targetServings) meta.push(`Serves: ${targetServings}`);
  if (recipe.totalTime) meta.push(`Total time: ${recipe.totalTime} min`);
  if (recipe.activeTime) meta.push(`Active time: ${recipe.activeTime} min`);
  if (recipe.source) meta.push(`Source: ${recipe.source}`);
  if (meta.length) { lines.push(meta.join(' | ')); lines.push(''); }

  if (recipe.authorNotes) {
    lines.push('Notes:', recipe.authorNotes, '');
  }

  if (finalIngredients.length) {
    lines.push('Ingredients');
    lines.push('-----------');
    for (const ing of finalIngredients) {
      const displayName = swapDisplayNames.get(ing.id) ?? ing.name;
      const amt = ing.amount !== null
        ? `${formatScaledAmount(ing.amount)}${ing.unit ? ' ' + ing.unit : ''}`
        : '';
      const optional = ing.isOptional ? ' (optional)' : '';
      const subNote = swapDisplayNames.has(ing.id) ? ` (substituted for ${ing.name})` : '';
      lines.push(`- ${amt ? amt + ' ' : ''}${displayName}${optional}${subNote}`);
    }
    lines.push('');
  }

  if (recipe.steps.length) {
    lines.push('Instructions');
    lines.push('------------');
    for (const step of recipe.steps) {
      const time = step.timeMinutes ? ` [${step.timeMinutes} min]` : '';
      const text = resolveIngredientRefsText(step.instruction, finalIngredients, 1, swapDisplayNames);
      lines.push(`${step.orderIndex + 1}. ${text}${time}`);
    }
    lines.push('');
  }

  if (recipe.personalNotes) {
    lines.push('Personal Notes:', recipe.personalNotes, '');
  }

  lines.push(`v${recipe.version} · Exported from Let Them Cook`);
  downloadFile(lines.join('\n'), `${safeName(recipe.title)}.txt`, 'text/plain;charset=utf-8');
}

export function exportRecipeAsJson(
  recipe: Recipe,
  finalIngredients: Ingredient[],
  swapDisplayNames: Map<string, string>,
  targetServings: number,
) {
  const data = {
    title: recipe.title,
    servings: targetServings,
    totalTime: recipe.totalTime,
    activeTime: recipe.activeTime,
    source: recipe.source,
    authorNotes: recipe.authorNotes,
    personalNotes: recipe.personalNotes,
    version: recipe.version,
    ingredients: finalIngredients.map((ing) => ({
      name: swapDisplayNames.get(ing.id) ?? ing.name,
      originalName: ing.originalName,
      amount: ing.amount,
      unit: ing.unit,
      isOptional: ing.isOptional,
      orderIndex: ing.orderIndex,
      ...(swapDisplayNames.has(ing.id) ? { substitutedFor: ing.name } : {}),
    })),
    steps: recipe.steps.map((step) => ({
      orderIndex: step.orderIndex,
      instruction: resolveIngredientRefsText(step.instruction, finalIngredients, 1, swapDisplayNames),
      timeMinutes: step.timeMinutes,
      isActiveTime: step.isActiveTime,
    })),
    labels: recipe.labels.map((rl) => rl.label.name),
    courses: recipe.courses.map((rc) => rc.courseType),
    exportedAt: new Date().toISOString(),
  };

  downloadFile(JSON.stringify(data, null, 2), `${safeName(recipe.title)}.json`, 'application/json');
}
