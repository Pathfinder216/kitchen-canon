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

/**
 * Formats a recipe as a plain-text block. Shared by the .txt download, the
 * native share sheet, and the email body so all three read identically.
 */
export function recipeToText(
  recipe: Recipe,
  finalIngredients: Ingredient[],
  swapDisplayNames: Map<string, string>,
  targetServings: number,
): string {
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

  lines.push(`v${recipe.version} · Exported from Kitchen Canon`);
  return lines.join('\n');
}

export function exportRecipeAsText(
  recipe: Recipe,
  finalIngredients: Ingredient[],
  swapDisplayNames: Map<string, string>,
  targetServings: number,
) {
  const text = recipeToText(recipe, finalIngredients, swapDisplayNames, targetServings);
  downloadFile(text, `${safeName(recipe.title)}.txt`, 'text/plain;charset=utf-8');
}

/** True when the browser exposes the Web Share API (mobile Safari/Chrome, etc). */
export function canShareRecipe(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Shares the recipe text via the native share sheet. User-cancellation rejects
 * with an `AbortError` which we swallow; other errors propagate to the caller.
 */
export async function shareRecipe(
  recipe: Recipe,
  finalIngredients: Ingredient[],
  swapDisplayNames: Map<string, string>,
  targetServings: number,
): Promise<void> {
  const text = recipeToText(recipe, finalIngredients, swapDisplayNames, targetServings);
  try {
    await navigator.share({ title: recipe.title, text });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    throw err;
  }
}

/**
 * Practical `mailto:` body ceiling. Some mail clients (and browsers building the
 * `mailto:` URL) silently drop everything past ~2000 chars, so we truncate the
 * body and point the reader at Share/Download for the complete recipe.
 */
export const MAILTO_BODY_MAX = 1800;
const MAILTO_TRUNCATION_NOTICE =
  '\n\n… recipe truncated here — use Share or Download for the full text.';

/** Builds the `mailto:` href, truncating an over-long body (see MAILTO_BODY_MAX). */
export function buildRecipeMailto(
  recipe: Recipe,
  finalIngredients: Ingredient[],
  swapDisplayNames: Map<string, string>,
  targetServings: number,
): string {
  const text = recipeToText(recipe, finalIngredients, swapDisplayNames, targetServings);
  let body = text;
  if (body.length > MAILTO_BODY_MAX) {
    body = body.slice(0, MAILTO_BODY_MAX - MAILTO_TRUNCATION_NOTICE.length) + MAILTO_TRUNCATION_NOTICE;
  }
  const subject = `Recipe: ${recipe.title}`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Opens the user's mail client with a prefilled subject + recipe body. */
export function emailRecipe(
  recipe: Recipe,
  finalIngredients: Ingredient[],
  swapDisplayNames: Map<string, string>,
  targetServings: number,
) {
  window.location.href = buildRecipeMailto(recipe, finalIngredients, swapDisplayNames, targetServings);
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
