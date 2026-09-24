import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import type { ActiveSwaps, CookingTimeline, TimelineEntry } from '../../types/meal-plan';
import { formatDuration } from '../../utils/formatDuration';
import { blockBackground, formatClock, minutesBetween } from '../../utils/timeline';

interface Props {
  timeline: CookingTimeline;
  planId: string;
  colorFor: (itemId: string) => string;
  /** Per plan item (MealRecipe id): servings + swaps to carry into cook mode. */
  items: Map<string, { title: string; servings: number; substitutions: ActiveSwaps | null }>;
  /** Wall-clock time for the "now" divider; null hides it. */
  now: Date | null;
  currentStepIds: Set<string>;
}

/** Chronological step-by-step schedule; each step links into cook mode at that step. */
export function ScheduleList({ timeline, planId, colorFor, items, now, currentStepIds }: Props) {
  const serveDate = new Date(timeline.serveAt);
  const nowMs = now?.getTime();
  const inRange = nowMs !== undefined
    && nowMs >= Date.parse(timeline.start) && nowMs <= Date.parse(timeline.serveAt);
  // The "now" divider goes before the first step that hasn't started yet.
  const nowIndex = inRange ? timeline.entries.findIndex((e) => Date.parse(e.start) > nowMs!) : -1;

  function row(e: TimelineEntry) {
    const item = items.get(e.itemId);
    const color = colorFor(e.itemId);
    const current = currentStepIds.has(e.stepId);
    const minutes = minutesBetween(e.start, e.end);
    return (
      <li
        className={`flex gap-3 items-stretch bg-white border rounded-lg px-3 py-2 ${
          current ? 'border-gray-900 ring-2 ring-gray-900' : 'border-gray-200'
        }`}
        aria-current={current ? 'step' : undefined}
        data-testid="schedule-entry"
      >
        <div className="w-20 shrink-0 text-xs text-gray-600 tabular-nums pt-0.5">
          <div className="font-semibold text-gray-900">{formatClock(e.start, serveDate)}</div>
          <div>→ {formatClock(e.end, serveDate)}</div>
        </div>
        <div
          className="w-1.5 shrink-0 rounded-full border"
          style={{ background: blockBackground(color, e.isActive), borderColor: color }}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium" style={{ color }}>{item?.title ?? 'Recipe'}</p>
          <p className="text-sm text-gray-900">{e.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {e.isActive ? 'Active' : 'Passive'}
            {minutes > 0 && ` · ${formatDuration(minutes)}`}
            {e.untimed && <span className="ml-1 text-amber-700">· untimed (estimated)</span>}
          </p>
        </div>
        <Link
          to={`/recipes/${e.recipeId}/cook`}
          state={{
            from: { label: 'Back to timeline', href: `/meal-plans/${planId}/timeline` },
            targetServings: item?.servings,
            activeSwaps: item?.substitutions ?? undefined,
            startStep: e.stepIndex,
          }}
          className="self-center text-sm text-orange-600 hover:text-orange-800 font-medium shrink-0 print:hidden"
          aria-label={`Cook ${item?.title ?? 'recipe'}, step ${e.stepIndex + 1}`}
        >
          Cook →
        </Link>
      </li>
    );
  }

  return (
    <ol className="space-y-2">
      {timeline.entries.map((e, i) => (
        <Fragment key={e.itemId + e.stepId}>
          {i === nowIndex && <NowDivider />}
          {row(e)}
        </Fragment>
      ))}
      {inRange && nowIndex === -1 && <NowDivider />}
      <li className="flex gap-3 items-center px-3 py-2 rounded-lg bg-gray-900 text-white">
        <span className="w-20 shrink-0 text-xs font-semibold tabular-nums">{formatClock(timeline.serveAt)}</span>
        <span className="text-sm font-semibold">Serve</span>
      </li>
    </ol>
  );
}

function NowDivider() {
  return (
    <li className="flex items-center gap-2 text-xs font-semibold text-red-600" data-testid="now-divider">
      <span className="h-px flex-1 bg-red-400" />
      Now
      <span className="h-px flex-1 bg-red-400" />
    </li>
  );
}
