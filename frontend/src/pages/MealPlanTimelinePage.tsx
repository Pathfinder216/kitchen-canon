import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMealPlan } from '../hooks/useMealPlans';
import { fetchMealPlanTimeline } from '../api/meal-plans';
import { TimelineChart } from '../components/timeline/TimelineChart';
import { ScheduleList } from '../components/timeline/ScheduleList';
import type { MealPlanDetail } from '../types/meal-plan';
import {
  currentEntries,
  defaultServeAtInput,
  formatClock,
  isSameLocalDay,
  localInputToIso,
  nextEntry,
  recipeColor,
} from '../utils/timeline';

/** Current wall-clock time, refreshed every `intervalMs`. */
function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function MealPlanTimelinePage() {
  const { id } = useParams<{ id: string }>();
  const { data: plan, isLoading, error } = useMealPlan(id!);

  if (isLoading) return <p className="text-gray-500">Loading meal plan…</p>;
  if (error || !plan) return <p className="text-red-600">Meal plan not found.</p>;

  return <TimelineView key={plan.id} plan={plan} />;
}

function TimelineView({ plan }: { plan: MealPlanDetail }) {
  const [serveAtInput, setServeAtInput] = useState(() => defaultServeAtInput(plan, new Date()));
  const [live, setLive] = useState(false);
  const now = useNow(15_000);
  const serveAt = localInputToIso(serveAtInput);

  const { data: timeline, isLoading, error } = useQuery({
    queryKey: ['meal-plans', plan.id, 'timeline', serveAt],
    queryFn: () => fetchMealPlanTimeline(plan.id, serveAt!),
    enabled: serveAt !== null,
    placeholderData: keepPreviousData,
  });

  const items = useMemo(
    () => new Map(plan.recipes.map((mr) => [mr.id, { title: mr.recipe.title, servings: mr.servings, substitutions: mr.substitutions }])),
    [plan.recipes],
  );
  const colorFor = useMemo(() => {
    const index = new Map(plan.recipes.map((mr, i) => [mr.id, i]));
    return (itemId: string) => recipeColor(index.get(itemId) ?? 0);
  }, [plan.recipes]);

  const showNow = timeline ? isSameLocalDay(now, new Date(timeline.serveAt)) : false;
  const current = live && timeline ? currentEntries(timeline.entries, now) : [];
  const currentStepIds = new Set(current.map((e) => e.stepId));
  const upcoming = live && timeline ? nextEntry(timeline.entries, now) : undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link to={`/meal-plans/${plan.id}`} className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block print:hidden">
          ← Back to meal plan
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Cooking timeline</h1>
        <p className="text-sm text-gray-600">{plan.name ?? 'Meal Plan'}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-sm text-gray-700">
          <span className="block font-medium mb-1">Serve at</span>
          <input
            type="datetime-local"
            value={serveAtInput}
            onChange={(e) => setServeAtInput(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => setLive((v) => !v)}
          className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
            live
              ? 'border border-gray-300 text-gray-700 hover:bg-gray-100'
              : 'bg-orange-600 text-white hover:bg-orange-700'
          }`}
        >
          {live ? 'Stop live mode' : 'Start cooking'}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          Print
        </button>
      </div>
      <p className="hidden print:block text-sm text-gray-900">Serve at {serveAt && formatClock(serveAt)}</p>

      {serveAt === null && <p className="text-sm text-red-600">Pick a serve time to build the timeline.</p>}
      {error && <p className="text-sm text-red-600">Could not build the timeline.</p>}
      {isLoading && serveAt !== null && <p className="text-gray-500">Building timeline…</p>}

      {timeline && (
        <>
          {/* Live mode banner */}
          {live && (
            <section className="bg-gray-900 text-white rounded-lg px-4 py-3 print:hidden" aria-live="polite" data-testid="live-banner">
              <p className="text-xs uppercase tracking-wide text-gray-400">Now · {formatClock(now)}</p>
              {current.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {current.map((e) => (
                    <li key={e.itemId + e.stepId} className="text-sm">
                      <span className="font-semibold">{items.get(e.itemId)?.title}:</span> {e.label}
                      {!e.isActive && <span className="text-gray-400"> (until {formatClock(e.end)})</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm mt-1">
                  {upcoming ? 'Nothing to do right now.' : 'All done — time to serve!'}
                </p>
              )}
              {upcoming && (
                <p className="text-sm text-gray-300 mt-1">
                  Next at {formatClock(upcoming.start, now)}: {items.get(upcoming.itemId)?.title} — {upcoming.label}
                </p>
              )}
            </section>
          )}

          {/* Make-ahead suggestions */}
          {timeline.makeAhead.length > 0 && (
            <section className="bg-sky-50 border border-sky-200 rounded-lg px-4 py-3" data-testid="make-ahead">
              <h2 className="text-sm font-semibold text-sky-900 mb-1">Consider making ahead</h2>
              <ul className="space-y-1">
                {timeline.makeAhead.map((m) => (
                  <li key={m.itemId + (m.stepId ?? '')} className="text-sm text-sky-900">
                    {m.message}{' '}
                    <span className="text-sky-700">Start by {formatClock(m.startBy, new Date(timeline.serveAt))}.</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Warnings (untimed steps, recipes without steps) */}
          {timeline.warnings.length > 0 && (
            <section className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <ul className="space-y-1">
                {timeline.warnings.map((w) => (
                  <li key={w.type + w.itemId} className="text-xs text-amber-800">{w.message}</li>
                ))}
              </ul>
            </section>
          )}

          {timeline.entries.length === 0 ? (
            <p className="text-sm text-gray-500">None of this plan&apos;s recipes have steps to schedule.</p>
          ) : (
            <>
              <p className="text-sm text-gray-700">
                Start at <span className="font-semibold">{formatClock(timeline.start, new Date(timeline.serveAt))}</span>
                {' '}to serve at <span className="font-semibold">{formatClock(timeline.serveAt)}</span>.
                <span className="text-gray-500"> Solid = hands-on, hatched = hands-off.</span>
              </p>
              <div className="print:hidden">
                <TimelineChart
                  timeline={timeline}
                  colorFor={colorFor}
                  now={showNow ? now : null}
                  currentStepIds={currentStepIds}
                />
              </div>
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Step by step</h2>
                <ScheduleList
                  timeline={timeline}
                  planId={plan.id}
                  colorFor={colorFor}
                  items={items}
                  now={showNow ? now : null}
                  currentStepIds={currentStepIds}
                />
              </section>
            </>
          )}

          <p className="text-xs text-gray-400 print:hidden">
            Assumes one cook (hands-on steps never overlap) and doesn&apos;t track shared equipment such as a single oven.
          </p>
        </>
      )}
    </div>
  );
}
