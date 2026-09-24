/**
 * Cooking timeline engine (plan 38).
 *
 * Given the recipes of a meal plan and a target serve time, produce a schedule saying when to
 * start every step. The model is deliberately simple and explainable:
 *
 *   1. One cook: **active** steps never overlap each other.
 *   2. A recipe's steps run in order (a step starts no earlier than its predecessor ends).
 *   3. **Passive** steps (oven, simmer, rest) may overlap anything.
 *   4. Every recipe finishes by serve time (holding food is not modelled).
 *
 * Algorithm — backward greedy list scheduling on a single "cook" resource:
 *   - Recipes are placed longest-first (stable on input order for ties).
 *   - Each recipe's steps are placed last-to-first, each as late as possible: it ends when its
 *     successor starts (the last step ends at serve time).
 *   - An active step that collides with an already-placed active step is slid earlier until it
 *     fits in a free gap; its predecessors are then placed relative to its new start. The recipe
 *     placed later (the shorter one) is therefore the one that yields.
 * Because every step is only ever moved earlier and is checked against everything already placed,
 * a single pass is stable — no fix-up iterations are needed.
 *
 * `computeTimeline` is pure (plain data in, plain data out, no Prisma) so it can be tested
 * exhaustively; `getMealPlanTimeline` is the thin DB loader the route calls.
 */

import { prisma } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';

export interface TimelineStepInput {
  id: string;
  instruction: string;
  /** Minutes the step takes; null/0/negative means "untimed" and gets a default. */
  timeMinutes: number | null;
  isActiveTime: boolean;
}

export interface TimelineRecipeInput {
  /** Unique per plan item (a plan may contain the same recipe twice). */
  id: string;
  recipeId: string;
  title: string;
  /** Steps in execution order. */
  steps: TimelineStepInput[];
}

export interface TimelineOptions {
  /** Duration assumed for an untimed active step. Default 5 min. */
  defaultActiveMinutes?: number;
  /** Duration assumed for an untimed passive step. Default 0 min. */
  defaultPassiveMinutes?: number;
}

export interface TimelineEntry {
  itemId: string;
  recipeId: string;
  stepId: string;
  /** Position of the step within its recipe (0-based). */
  stepIndex: number;
  start: Date;
  end: Date;
  isActive: boolean;
  /** True when the step had no time and the default duration was used. */
  untimed: boolean;
  label: string;
}

export interface TimelineRecipeSummary {
  itemId: string;
  recipeId: string;
  title: string;
  /** Null when the recipe has no steps. */
  start: Date | null;
  end: Date | null;
}

export interface TimelineWarning {
  type: 'untimed-steps' | 'no-steps';
  itemId: string;
  recipeId: string;
  stepIds: string[];
  message: string;
}

export interface MakeAheadSuggestion {
  itemId: string;
  recipeId: string;
  /** The long passive step, or null when the flag is for the recipe's early start overall. */
  stepId: string | null;
  reason: 'long-passive-step' | 'early-start';
  /** How long before serve time the flagged step / recipe starts, in minutes. */
  leadMinutes: number;
  /** When the flagged step / recipe must start at the latest. */
  startBy: Date;
  message: string;
}

export interface Timeline {
  serveAt: Date;
  /** Earliest entry start (equals serveAt when there are no entries). */
  start: Date;
  entries: TimelineEntry[];
  recipes: TimelineRecipeSummary[];
  warnings: TimelineWarning[];
  makeAhead: MakeAheadSuggestion[];
}

export const DEFAULT_ACTIVE_MINUTES = 5;
export const DEFAULT_PASSIVE_MINUTES = 0;
/** A passive step at least this long is flagged as make-ahead. */
export const MAKE_AHEAD_PASSIVE_MINUTES = 4 * 60;
/** A recipe starting more than this long before serving is flagged as make-ahead. */
export const MAKE_AHEAD_LEAD_MINUTES = 8 * 60;

const MINUTE_MS = 60_000;
const REF_PATTERN = /\{([^}:]+)(?::\d+(?:\.\d+)?%)?\}/g;

/** Instruction text with `{butter}` / `{butter:50%}` ingredient refs reduced to the bare name. */
export function stepLabel(instruction: string): string {
  return instruction.replace(REF_PATTERN, '$1').replace(/\s+/g, ' ').trim();
}

function isUntimed(timeMinutes: number | null): boolean {
  return timeMinutes == null || !Number.isFinite(timeMinutes) || timeMinutes <= 0;
}

/** Half-open-ish overlap test used both by the scheduler and the tests' invariant check. */
export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function formatHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} h`;
}

function suggestedBlock(leadMinutes: number): string {
  return leadMinutes >= 12 * 60 ? 'the evening before' : 'earlier in the day';
}

interface PlacedStep {
  step: TimelineStepInput;
  stepIndex: number;
  /** Offsets in minutes relative to serve time (≤ 0). */
  start: number;
  end: number;
  isActive: boolean;
  untimed: boolean;
}

export function computeTimeline(
  recipes: TimelineRecipeInput[],
  serveAt: Date,
  options: TimelineOptions = {},
): Timeline {
  const defaultActive = options.defaultActiveMinutes ?? DEFAULT_ACTIVE_MINUTES;
  const defaultPassive = options.defaultPassiveMinutes ?? DEFAULT_PASSIVE_MINUTES;

  const durationOf = (step: TimelineStepInput) => {
    if (!isUntimed(step.timeMinutes)) return step.timeMinutes as number;
    return step.isActiveTime ? defaultActive : defaultPassive;
  };

  // Longest recipe first; ties keep input order (Array.prototype.sort is stable).
  const order = recipes
    .map((recipe, index) => ({
      recipe,
      index,
      total: recipe.steps.reduce((sum, s) => sum + durationOf(s), 0),
    }))
    .sort((a, b) => b.total - a.total || a.index - b.index);

  /** Active intervals already claimed by the cook, as [start, end] offsets. */
  const busy: [number, number][] = [];
  const placedByRecipe = new Map<string, PlacedStep[]>();

  for (const { recipe } of order) {
    const placed: PlacedStep[] = [];
    let latestEnd = 0; // the last step ends at serve time
    for (let i = recipe.steps.length - 1; i >= 0; i--) {
      const step = recipe.steps[i];
      const duration = durationOf(step);
      let end = latestEnd;
      let start = end - duration;
      if (step.isActiveTime) {
        // Slide earlier until the step fits between already-placed active steps. `end` strictly
        // decreases on every iteration and `busy` is finite, so this terminates.
        for (;;) {
          const conflicts = busy.filter(([bs, be]) => intervalsOverlap(start, end, bs, be));
          if (conflicts.length === 0) break;
          end = Math.min(...conflicts.map(([bs]) => bs));
          start = end - duration;
        }
        busy.push([start, end]);
      }
      placed.unshift({
        step,
        stepIndex: i,
        start,
        end,
        isActive: step.isActiveTime,
        untimed: isUntimed(step.timeMinutes),
      });
      latestEnd = start;
    }
    placedByRecipe.set(recipe.id, placed);
  }

  const toDate = (offset: number) => new Date(serveAt.getTime() + offset * MINUTE_MS);

  const entries: TimelineEntry[] = [];
  const summaries: TimelineRecipeSummary[] = [];
  const warnings: TimelineWarning[] = [];
  const makeAhead: MakeAheadSuggestion[] = [];

  // Reporting is in the plan's own recipe order so the output reads naturally.
  for (const recipe of recipes) {
    const placed = placedByRecipe.get(recipe.id) ?? [];

    if (placed.length === 0) {
      summaries.push({ itemId: recipe.id, recipeId: recipe.recipeId, title: recipe.title, start: null, end: null });
      warnings.push({
        type: 'no-steps',
        itemId: recipe.id,
        recipeId: recipe.recipeId,
        stepIds: [],
        message: `"${recipe.title}" has no steps, so it isn't on the timeline.`,
      });
      continue;
    }

    for (const p of placed) {
      entries.push({
        itemId: recipe.id,
        recipeId: recipe.recipeId,
        stepId: p.step.id,
        stepIndex: p.stepIndex,
        start: toDate(p.start),
        end: toDate(p.end),
        isActive: p.isActive,
        untimed: p.untimed,
        label: stepLabel(p.step.instruction),
      });
    }

    const recipeStart = placed[0].start;
    summaries.push({
      itemId: recipe.id,
      recipeId: recipe.recipeId,
      title: recipe.title,
      start: toDate(recipeStart),
      end: toDate(placed[placed.length - 1].end),
    });

    const untimed = placed.filter((p) => p.untimed);
    if (untimed.length > 0) {
      const n = untimed.length;
      warnings.push({
        type: 'untimed-steps',
        itemId: recipe.id,
        recipeId: recipe.recipeId,
        stepIds: untimed.map((p) => p.step.id),
        message:
          `"${recipe.title}" has ${n} untimed step${n === 1 ? '' : 's'}; assumed ` +
          `${defaultActive} min for active and ${defaultPassive} min for passive steps.`,
      });
    }

    let flaggedStep = false;
    for (const p of placed) {
      if (p.isActive || p.untimed || (p.step.timeMinutes as number) < MAKE_AHEAD_PASSIVE_MINUTES) continue;
      flaggedStep = true;
      const lead = -p.start;
      makeAhead.push({
        itemId: recipe.id,
        recipeId: recipe.recipeId,
        stepId: p.step.id,
        reason: 'long-passive-step',
        leadMinutes: lead,
        startBy: toDate(p.start),
        message:
          `"${recipe.title}" has a ${formatHours(p.step.timeMinutes as number)} passive step ` +
          `("${stepLabel(p.step.instruction)}") — consider making it ahead, e.g. ${suggestedBlock(lead)}.`,
      });
    }

    const lead = -recipeStart;
    if (!flaggedStep && lead > MAKE_AHEAD_LEAD_MINUTES) {
      makeAhead.push({
        itemId: recipe.id,
        recipeId: recipe.recipeId,
        stepId: null,
        reason: 'early-start',
        leadMinutes: lead,
        startBy: toDate(recipeStart),
        message:
          `"${recipe.title}" has to start ${formatHours(lead)} before serving — consider making it ahead, ` +
          `e.g. ${suggestedBlock(lead)}.`,
      });
    }
  }

  entries.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  const earliest = entries.length > 0 ? entries[0].start : serveAt;

  return { serveAt, start: earliest, entries, recipes: summaries, warnings, makeAhead };
}

/**
 * Timeline for one of the user's meal plans. Uses the same recipe rows the plan detail shows:
 * `MealRecipe.recipeId` points at the exact (pinned) version row, since every edit creates a new
 * `Recipe` row rather than mutating the old one.
 */
export async function getMealPlanTimeline(userId: string, mealPlanId: string, serveAt: Date): Promise<Timeline> {
  const mealPlan = await prisma.mealPlan.findFirst({
    where: { id: mealPlanId, userId },
    include: {
      recipes: {
        include: {
          recipe: {
            select: {
              id: true,
              title: true,
              steps: {
                orderBy: { orderIndex: 'asc' },
                select: { id: true, instruction: true, timeMinutes: true, isActiveTime: true },
              },
            },
          },
        },
        orderBy: { orderIndex: 'asc' },
      },
    },
  });
  if (!mealPlan) throw new AppError(404, 'Meal plan not found');

  return computeTimeline(
    mealPlan.recipes.map((mr) => ({
      id: mr.id,
      recipeId: mr.recipeId,
      title: mr.recipe.title,
      steps: mr.recipe.steps,
    })),
    serveAt,
  );
}
