# 18 — Canonical ingredient units (consistent abbreviations everywhere)

**Size:** M | **Depends on:** nothing | **Blocks:** 27 (conversion), helps 19 (import), 33 (nutrition)

## Goal
Units are free text today — imports produce `tablespoons`, manual entry `tbsp`, another recipe
`Tbsp`. The user wants every unit displayed as a consistent abbreviation app-wide. This also
fixes grocery consolidation, which keys on exact unit string (`grocery.service.ts:20`), so
`2 tbsp butter` + `1 tablespoon butter` currently become two grocery lines.

## Design
One backend module owns the unit vocabulary; normalization happens **at write time** (create,
update, import) so stored data is canonical. Canonical forms are the common abbreviations:
`tsp`, `tbsp`, `cup`, `fl oz`, `pt`, `qt`, `gal`, `oz`, `lb`, `g`, `kg`, `ml`, `l`, `pinch`,
`dash`, `clove`, `can`, `slice`, `stick`, `bunch`, `sprig`, `head`, `piece` — plus pass-through
for unrecognized units (never destroy user input; store trimmed lowercase as-is).

## Implementation

1. `backend/src/constants/units.ts`:
   - `CANONICAL_UNITS`: the list above, each with `{ canonical, synonyms: string[], system?: 'imperial'|'metric', kind?: 'volume'|'weight'|'count' }`
     (system/kind fields are groundwork for plan 27 — populate them now).
   - Synonyms cover singular/plural/long forms/periods/case: `tablespoon(s)`, `tbsp(s)`, `tbs`,
     `T`; `teaspoon(s)`, `tsp`, `t`; `pound(s)`, `lbs`, `lb.`; `ounce(s)`, `oz.`; `gram(s)`,
     `grams`, `gr`; `milliliter/millilitre(s)`, `liter/litre(s)`, `c`, `cups`, etc.
     ⚠️ `T` (tbsp) vs `t` (tsp) are case-sensitive — match those two exact-case before the
     general lowercase pass.
   - `normalizeUnit(raw: string | null): string | null`.
2. Apply at write time:
   - Recipe create/update: in the Zod ingredient schema (`backend/src/schemas/recipe.schema.ts`)
     via `.transform(normalizeUnit)` on `unit`, so every path through validation is covered.
   - Import: `import.service.ts`'s ingredient-line parser output — normalize there too (it may
     bypass the recipe schema depending on flow; check and cover).
   - Grocery consolidation then needs no change (inputs arrive canonical), but add a defensive
     `normalizeUnit` in `consolidateIngredients` keying since old stored data exists.
3. One-time data migration script `backend/scripts/normalize-units.ts` (run with tsx): update
   `Ingredient.unit` and `GroceryItem.unit` across all rows to canonical forms. Document
   running it once after deploy in the PR (no schema change, safe to run anytime,
   idempotent).
4. Frontend: no logic change — it displays stored units. Update the unit input in the recipe
   form to a datalist/ComboInput suggesting canonical units (free text still allowed).
5. Tests: unit-table tests (`tablespoons`→`tbsp`, `T`→`tbsp`, `t`→`tsp`, `Grams`→`g`, unknown
   `handful`→`handful`); import test: a fixture line `2 Tablespoons olive oil` stores
   `tbsp`; grocery test: `tbsp` + `tablespoon` lines consolidate to one entry.

## Acceptance
All new/edited/imported ingredient units store canonically; grocery list consolidates
across spelling variants; migration script converges existing data.
