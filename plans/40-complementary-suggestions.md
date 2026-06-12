# 40 — Complementary recipe suggestions in meal planning

**Size:** M | **Depends on:** none required; 08 (decomposed form) makes the UI slot cleaner

## Goal
Spec §4 future enhancement: while building a meal plan, suggest recipes that complement the
current selection (salad entrée chosen → prioritize non-salad sides).

## Scoring model (decided — transparent rules, no ML)

`GET /api/meal-plans/suggestions?recipeIds=a,b,c` returns the user's candidate recipes (latest,
unarchived, not already selected) scored by:

1. **Course complement** (+3): recipe fills a course absent from the selection. Target
   composition: MAIN + SIDE (+ optional DESSERT/SALAD/BREAD). Missing MAIN → mains get the
   boost; selection has a MAIN → sides/salads/desserts do.
2. **Course redundancy** (−2): per course already covered by the selection (two salads, etc.).
3. **Diet compatibility** (+2 / −3): candidate's auto diet labels ⊇ the intersection of the
   selection's diets → +2 (keeps a vegetarian meal vegetarian); candidate introduces an
   allergen absent from every selected recipe → −3 (don't contaminate an allergen-free meal).
   Derived from existing recipe dietary labels — no new computation.
4. **Ingredient overlap** (+0.5 each, max +1.5): shared catalog-resolved ingredients with the
   selection (pantry efficiency; small weight so it never dominates).
5. **History novelty** (+1): not cooked in the last 30 days (`MealPlan.cookedAt` joins).

Return top 6 with score breakdown: `{ recipe, score, reasons: ["fills side course", "keeps
meal vegetarian"] }` — reasons render in the UI; explainability is the feature.

## Implementation

1. `backend/src/services/suggestions.service.ts`: pure scoring function
   `scoreCandidates(selection: RecipeFacts[], candidates: RecipeFacts[]): Scored[]` (no
   Prisma — testable), plus a loader assembling `RecipeFacts` (courses, dietary labels,
   resolved ingredient catalogIds, lastCookedAt) for the user's recipes. Route in
   `routes/meal-plans.ts` (validate ids belong to user — 404 otherwise, conventions).
2. Unit-test the scorer exhaustively: each rule in isolation + the salad-entrée motivating
   case (selection = salad MAIN → side dishes outrank other salads); empty selection → returns
   highest-variety starters (just course-target scoring); allergen-introduction penalty.
3. Frontend: in MealPlanFormPage (or `meal-plan-form/` components after 08), under the
   selected-recipes section: "Goes well with this meal" — up to 3 suggestion cards with their
   reason chips and one-tap Add. Refetch on selection change (debounced; key
   `['suggestions', sortedIds]`). Hide entirely when the user has < 5 recipes (suggestions
   from a tiny pool feel broken — threshold check server-side, return `[]`).
4. Respect the form's active dietary filter (plan section at `MealPlanFormPage.tsx:450-466`):
   pass the filter to the endpoint and exclude non-matching candidates before scoring.
5. RTL: suggestions render with reasons; Add inserts into selection and the suggestion list
   updates.

## Acceptance
Selecting a salad main yields side/bread/dessert suggestions with readable reasons, never
another salad at the top; vegetarian selections don't suggest meat mains; one-tap add works;
spec §8 stretch goal updated.
