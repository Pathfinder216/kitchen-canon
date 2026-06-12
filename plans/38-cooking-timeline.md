# 38 — Cooking timeline (automatic schedule for a meal plan)

**Size:** L | **Depends on:** nothing (13 improves input data; 25's labels are NOT a dependency)

## Goal
Spec §4 long-term goal: given a meal plan and a target serve time, generate a cooking schedule —
when to start each recipe, interleaving steps so active work never overlaps, passive time
(oven/simmer) runs concurrently, and make-ahead components are flagged.

## Scheduling model (decided — keep it greedy and explainable)

- Inputs: each plan recipe's ordered steps with `timeMinutes` + `isActiveTime`; steps without
  times get a configurable default (active: 5 min, passive: 0 — surface "untimed" in the UI).
- Constraints: (1) one cook — **active** steps must not overlap each other; (2) a recipe's
  steps execute in order; (3) passive steps may overlap anything; (4) every recipe finishes by
  serve time (no hold-time modeling in v1).
- Algorithm: backward greedy. Schedule recipes by descending total duration; for each, place
  its steps as late as possible ending at serve time, then resolve active-step collisions by
  shifting the later-starting recipe's conflicting active step (and its predecessors) earlier.
  Iterate until stable (bounded passes; total steps are small — dozens, not thousands). This is
  effectively list scheduling on a single "cook" resource; optimality isn't required,
  explainability is.
- Make-ahead detection: any step with passive `timeMinutes ≥ 240` (4 h), or a recipe whose
  schedule would start > 8 h before serving, gets flagged "consider making ahead" with a
  suggested earlier block (e.g. evening before). Label-based hints are deliberately NOT used
  (string matching on label names is brittle) — duration-derived only.

## Implementation

1. **Pure engine first**: `backend/src/services/timeline.service.ts` —
   `computeTimeline(recipes: TimelineRecipeInput[], serveAt: Date): Timeline` where the input
   is plain data (no Prisma) and the output is
   `{ entries: [{ recipeId, stepId, start, end, isActive, label }], warnings: [...],
   makeAhead: [...] }`. Exhaustive unit tests on the pure function:
   - single recipe back-scheduled to serve time;
   - two recipes whose active steps collide → no active overlap in output, order preserved
     per recipe;
   - passive-heavy recipe (roast) overlapping active prep of another;
   - untimed steps get defaults + warning;
   - 12 h brine → make-ahead flag;
   - property check: ∀ output, no two active intervals intersect & per-recipe step order holds
     (write as a loop over randomized small inputs — `fast-check` is already in backend
     node_modules; use it if convenient, else hand-rolled cases suffice).
2. Route: `GET /api/meal-plans/:id/timeline?serveAt=<ISO>` — loads the plan's recipes
   (pinned versions — note `MealRecipe.recipeVersion`; resolve the same rows the plan detail
   uses in `meal-plan.service.ts`), maps to engine input, returns the timeline. Validate
   serveAt (Zod, must parse; allow past for preview). Supertest happy path + 404 isolation.
3. **Frontend** `pages/MealPlanTimelinePage.tsx` (route `/meal-plans/:id/timeline`, linked from
   MealPlanDetailPage):
   - serve-time picker (default: plan's `date`+`time` if set, else now+3h);
   - vertical timeline: time gutter + entries grouped visually by recipe (color per recipe),
     active steps solid / passive hatched, "now" line when serveAt is today;
   - make-ahead suggestions box at top;
   - each entry links into cook mode for that recipe.
   Keep it read-only v1 (no drag-to-adjust).
4. **Cook-along (small, high value)**: a "start cooking" button that switches the timeline to
   live mode — highlights the current entry by wall clock. No notifications in v1 (note as
   future).
5. Docs: spec §4 marks the long-term goal as shipped-v1 with documented constraints (single
   cook, no equipment contention modeling — one oven isn't tracked; note as future).

## Acceptance
A 3-recipe plan (roast + stovetop side + salad) produces a sensible printed schedule: salad
prep slotted into the roast's oven window, no overlapping active steps, roast start time
correct relative to serve time; engine test suite green including the no-active-overlap
invariant.
