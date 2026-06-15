# Implementation Plans

Task-sized plans, each written to be implemented autonomously. **Start every task by reading
[00-conventions.md](00-conventions.md)** — it holds the codebase patterns and traps the plans
assume. Check items off here as they land.

Sources: the 2026-06-11 code review, the project TODO notes, and the unfinished items in
`specification.md` §8. When a plan ships, update the spec's Implementation Status section
(and architecture.md for new models/routes/deps) — each plan's acceptance section says so.

## 🔴 Security (urgent — the app is internet-facing; these jump the queue)

From an external security review: the app is exposed to the internet over plain HTTP with open
signup and an SSRF-able URL importer. 43 and 42 are pure code and can land today; 41 needs the
Pi; 44 is defense-in-depth after the first three.

- [x] [41 — HTTPS via reverse proxy + secure cookies](41-https-tls.md) (M) — repo-side landed (trust-proxy, loopback bind, `COOKIE_SECURE=true`, `deploy/nginx/letthemcook.conf`, docs); Pi nginx-vhost + certbot + DuckDNS cutover is the operator runbook (host nginx already owns :443, so no Caddy service)
- [x] [42 — Rate limiting + gated signup](42-auth-rate-limit-signup.md) (S-M) — `express-rate-limit` per-IP limiters on auth + import; `SIGNUP_INVITE_CODE` gates registration (constant-time check); deploy script generates + echoes an invite code
- [x] [43 — Fix SSRF in import-from-URL](43-ssrf-import-url.md) (S-M) — `src/utils/safeFetch.ts` hardens user-URL fetches (scheme/credential/host/DNS-range checks, manual redirect re-validation, 2 MB + content-type caps); `importFromUrl` uses it; 56-test unit suite
- [x] [44 — Enable CSP + non-root container](44-csp-container-hardening.md) (S-M) — production-only strict CSP via helmet (no inline scripts; `script-src 'self'`); Dockerfile runs as `node` user with node-owned `/app/data`; one-time `chown` migration documented for existing volumes

## Foundation & quality (do roughly in order)

- [x] [01 — Fix the 12 failing frontend tests](01-fix-frontend-tests.md) (S) — blocks 02 and all refactors
- [x] [02 — GitHub Actions CI](02-ci-github-actions.md) (S)
- [x] [03 — Deploy script `--with-data` flag](03-deploy-data-flag.md) (S) — **do before the next Pi deploy**
- [x] [04 — Dietary tags served from the API](04-dietary-tags-api.md) (S-M) — `GET /api/meta` is the single source of truth; `useDietaryTags()` hook feeds the 6 consumers. Deviation from plan: the static frontend mirror was **deleted** (not kept as a fallback), so the CI mirror-guard script was unnecessary — the hook degrades to empty structures during the sub-second cold-load fetch instead
- [x] [05 — Shared Modal/Menu primitives (Headless UI)](05-ui-primitives.md) (S-M) — blocks 06–09, 26 — `components/ui/Modal.tsx` (Headless UI Dialog) + `components/ui/Menu.tsx` (anchored dropdown); every overlay (RecipeForm 3 dialogs, RecipeDetailPage delete + substitutions, MealPlanFormPage preview modal + swap) migrated; Floating-UI anchored menus replaced the manual fixed-position popovers; RTL tests for both
- [x] [06 — Decompose RecipeForm](06-decompose-recipe-form.md) (M-L) — split the 1046-line `RecipeForm.tsx` into `components/recipe-form/`; composition file 210 lines; zero behavior change (11 existing tests pass unmodified) + new `useRecipeFormState` hook tests
- [x] [07 — Decompose CookModePage](07-decompose-cook-mode.md) (M) — timer system extracted to `hooks/useStepTimers.ts` (state machine + `formatTime` + `playTimerSound`, audio via `onComplete` callback); `components/cook-mode/` holds `TimerPanel`, `StepTimerControls`, `StepCard`, `IngredientChecklist`; page down to 172 lines; checked-ingredient state kept in page; added 8 `useStepTimers` fake-timer tests; all 11 CookModePage tests pass unchanged
- [x] [08 — Decompose MealPlanFormPage](08-decompose-meal-plan-form.md) (M) — extracted `components/meal-plan-form/` (page 743→198 lines); candidate filtering stays in the existing `FilterPanel`; new 6-test characterization suite; zero behavior change
- [x] [09 — Decompose RecipeDetailPage](09-decompose-recipe-detail.md) (M) — extracted `components/recipe-detail/`; inner composition under ~200 lines; new 5-test characterization suite; zero behavior change

## Bugs & small improvements (independent; any order)

- [x] [45 — Responsive mobile navigation](45-mobile-nav-responsive.md) (S-M, bug) — hamburger toggle below `sm`; desktop row unchanged; active-highlight via shared `linkClass` helper; closes on navigation; RTL test
- [x] [10 — Fix stale unclassified-ingredients banner](10-fix-unclassified-banner.md) (S, bug) — `InlineClassifyPanel` now also invalidates `['recipe-dietary', recipeId]` (threaded RecipeForm→IngredientsEditor→panel); meal-plan
- [x] [11 — Remove alias names from ingredient list](11-remove-alias-names-from-ingredient-list.md) (S) — dropped the `(coriander)` parenthetical from **every** UI display per user request: recipe-detail list (`RecipeIngredientList` + `PrintLayout`), `GroceryList`, cook-mode `IngredientChecklist`, and the now-dead `IngredientList`. `utils/ingredientAliases.ts` is kept (display-unused now) — alias **filtering/search** is unaffected (powered by the catalog, not this static helper). Note: plan named pre-decomposition `IngredientList.tsx`; the live list is `recipe-detail/RecipeIngredientList.tsx`
- [ ] [12 — Hours + minutes duration display](12-duration-display-hours.md) (S)
- [x] [13 — Hours/minutes input for step times](13-step-time-hm-input.md) (S) — `StepsEditor` step time is now a two-field `h`/`min` widget (`StepTimeInput`, empty-able string state, emits `h*60+m`); storage stays `timeMinutesText` (minutes). Backend unchanged (schema has no max). 3 RecipeForm tests (h+m submit, minutes-only, seeding 90→1/30)
- [ ] [14 — Empty-able meal plan servings input](14-meal-plan-servings-input.md) (S; after 08 if both queued)
- [ ] [15 — Read-only global ingredients + Customize flow](15-readonly-global-ingredients.md) (S-M)
- [ ] [16 — Media visibility toggle](16-media-visibility-toggle.md) (S)
- [ ] [17 — Cook mode wake lock + swipe navigation](17-wake-lock-swipe.md) (S-M)

## Features

- [ ] [18 — Canonical ingredient units](18-unit-normalization.md) (M) — do before 19, 27
- [ ] [19 — Import hardening](19-import-hardening.md) (M)
- [ ] [20 — Fuzzy matching for filtering/search/typeahead](20-fuzzy-matching.md) (M) — do before 34
- [ ] [21 — Seed global substitutions](21-global-substitutions-seed.md) (S-M)
- [ ] [22 — Implement LocalizationMapping](22-localization-mappings.md) (M)
- [ ] [23 — Per-ingredient notes](23-ingredient-notes.md) (M)
- [ ] [24 — Remaining-percent ingredient refs](24-remaining-percent-refs.md) (M)
- [ ] [25 — Equipment & make-ahead labels](25-equipment-makeahead-labels.md) (S-M)
- [ ] [26 — Image crop + natural aspect display](26-image-crop-aspect.md) (M; needs 05)
- [ ] [27 — Unit conversion (imperial↔metric, temperatures)](27-unit-conversion.md) (M-L; needs 18)
- [ ] [28 — Grocery aisle grouping](28-grocery-aisles.md) (M)
- [ ] [29 — Share: native/email/PDF](29-sharing-text-pdf.md) (S-M)
- [ ] [30 — Shareable links (public token view)](30-share-links.md) (M)
- [ ] [31 — Bulk export (schema.org + proprietary)](31-schema-org-export.md) (M)
- [ ] [32 — Photo/OCR import](32-ocr-import.md) (M; needs 19)
- [ ] [33 — Component recipes](33-component-recipes.md) (L)

## Big systems

- [ ] [34 — Nutrition data (USDA lookup + copy-from-similar)](34-nutrition-data.md) (L; needs 20)
- [ ] [35 — Nutrition aggregation & display](35-nutrition-display.md) (M; needs 34, 18)
- [ ] [36 — Offline writes](36-offline-writes.md) (L; needs 01, 04) — blocks 37
- [ ] [37 — Multi-device sync](37-device-sync.md) (XL, staged milestones; needs 36)
- [ ] [38 — Cooking timeline](38-cooking-timeline.md) (L)
- [ ] [39 — Publishing to other users](39-publishing.md) (L; needs 30)
- [ ] [40 — Complementary recipe suggestions](40-complementary-suggestions.md) (M)

## Dependency highlights

```
01 → 02            05 → 06,07,08,09,26      18 → 19 → 32       20 → 34 → 35
04 → 36 → 37       30 → 39                  08 → 14            18 → 27
41 → 17 (wake lock needs HTTPS)             41/42 share the trust-proxy line
```

Everything else is independent. Decisions already made (don't re-litigate inside a task):
Headless UI + react-easy-crop for UI deps; USDA FoodData Central live API for nutrition;
LocalizationMapping is implemented, not deleted; sync keeps the server as relay + replica;
PDF = print stylesheet; OCR is client-side; TLS via Caddy (compose service if the Pi's 443 is
free, else a vhost on the existing 443 server); signup gated by `SIGNUP_INVITE_CODE`.
