import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeUnit } from '../constants/units.js';
import type { NutrientKey, NutritionData, Per100g } from '../schemas/nutrition.schema.js';

/**
 * USDA FoodData Central (FDC) proxy for the ingredient-catalog nutrition lookup (plan 34).
 *
 * The backend holds the API key (sent as the api.data.gov `X-Api-Key` header, so it never appears
 * in a URL or reaches the client) and normalizes FDC's responses to the catalog's storage shape.
 * FDC is only consulted while a user classifies an ingredient; the confirmed result is stored on
 * the catalog row, so recipe rendering never depends on FDC being reachable.
 */

export const FDC_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
/** Data types with per-100 g analytical data for generic foods (no branded products). */
export const FDC_DATA_TYPES = ['Foundation', 'SR Legacy'];
export const FDC_SEARCH_PAGE_SIZE = 5;
const FDC_TIMEOUT_MS = 10_000;
/** Minimum spacing between upstream calls. Default FDC keys allow 1000 requests/hour. */
const DEFAULT_MIN_INTERVAL_MS = 500;

/**
 * FDC nutrient ids per storage key, most preferred first. Foundation foods often report energy
 * only as Atwater factors (2048 specific / 2047 general) and sugar as 1063 "Sugars, Total";
 * SR Legacy uses 1008 / 2000. Fat and carbs fall back to the NLEA / by-summation variants.
 */
const NUTRIENT_IDS: Record<NutrientKey, number[]> = {
  calories: [1008, 2048, 2047],
  protein: [1003],
  fat: [1004, 1085],
  saturatedFat: [1258],
  carbs: [1005, 1050],
  fiber: [1079],
  sugar: [2000, 1063],
  sodium: [1093],
};
/** Energy in kJ — converted to kcal only when no kcal figure exists. */
const ENERGY_KJ_ID = 1062;
const KJ_PER_KCAL = 4.184;

/**
 * FDC nutrient *numbers* (not ids) for the detail endpoint's `nutrients` filter, which keeps
 * a Foundation food's response from ballooning to ~700 KB of nutrients we don't store.
 */
const DETAIL_NUTRIENT_NUMBERS = [
  '208', '957', '958', '268', // energy: kcal, Atwater general, Atwater specific, kJ
  '203', '204', '298', '606', '205', '205.2', '291', '269', '269.3', '307',
];

/** Portion units that aren't real units ("RACC" = FDA reference amount, a serving size). */
const IGNORED_PORTION_UNITS = new Set(['undetermined', 'racc', 'quantity not specified', '']);

// ---------------------------------------------------------------------------
// FDC response shapes (only the fields we read)
// ---------------------------------------------------------------------------

/** A nutrient row: search results use the flat shape, food details the nested one. */
interface FdcNutrient {
  nutrientId?: number;
  value?: number;
  unitName?: string;
  nutrient?: { id?: number; unitName?: string };
  amount?: number;
}

interface FdcPortion {
  gramWeight?: number;
  amount?: number;
  modifier?: string;
  sequenceNumber?: number;
  measureUnit?: { name?: string; abbreviation?: string };
}

interface FdcFood {
  fdcId: number;
  description?: string;
  dataType?: string;
  foodCategory?: string | { description?: string };
  foodNutrients?: FdcNutrient[];
  foodPortions?: FdcPortion[];
}

interface FdcSearchResponse {
  foods?: FdcFood[];
}

/** One normalized FDC food, ready to prefill the classify form. */
export interface FdcMatch {
  fdcId: number;
  description: string;
  dataType: string | null;
  foodCategory: string | null;
  nutrition: NutritionData;
}

// ---------------------------------------------------------------------------
// Normalization (pure — pinned by the recorded-fixture tests)
// ---------------------------------------------------------------------------

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Map FDC nutrient rows to the per-100 g storage shape (FDC values are already per 100 g). */
export function normalizeNutrients(rows: FdcNutrient[] | undefined): Per100g {
  const byId = new Map<number, number>();
  for (const row of rows ?? []) {
    const id = row.nutrientId ?? row.nutrient?.id;
    const value = row.value ?? row.amount;
    if (typeof id !== 'number' || typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue;
    if (!byId.has(id)) byId.set(id, value);
  }
  const per100g: Per100g = {};
  for (const [key, ids] of Object.entries(NUTRIENT_IDS) as [NutrientKey, number[]][]) {
    const id = ids.find((i) => byId.has(i));
    if (id !== undefined) per100g[key] = round(byId.get(id)!);
  }
  if (per100g.calories === undefined && byId.has(ENERGY_KJ_ID)) {
    per100g.calories = Math.round(byId.get(ENERGY_KJ_ID)! / KJ_PER_KCAL);
  }
  return per100g;
}

/**
 * Extract a canonical-unit → grams-per-one-unit map from FDC `foodPortions`.
 *
 * SR Legacy portions carry the unit in `modifier` ("cup", "tbsp", "container (7 oz)") with a
 * measureUnit of "undetermined"; Foundation portions name it in `measureUnit` and may add a
 * descriptive modifier ("chopped"). Labels are cut at the first comma/parenthesis and run through
 * the plan-18 unit normalizer so keys line up with recipe ingredient units ("quart" → "qt").
 * The first portion (by sequence number) wins per unit.
 */
export function normalizePortions(portions: FdcPortion[] | undefined): Record<string, number> | undefined {
  const sorted = [...(portions ?? [])].sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));
  const out: Record<string, number> = {};
  for (const p of sorted) {
    if (typeof p.gramWeight !== 'number' || !(p.gramWeight > 0)) continue;
    const unitName = p.measureUnit?.name?.trim() ?? '';
    const raw = IGNORED_PORTION_UNITS.has(unitName.toLowerCase()) ? (p.modifier ?? '') : unitName;
    const label = raw.split(/[,(]/)[0].trim();
    if (IGNORED_PORTION_UNITS.has(label.toLowerCase())) continue;
    const unit = normalizeUnit(label);
    if (!unit || unit.length > 40 || unit in out) continue;
    const amount = typeof p.amount === 'number' && p.amount > 0 ? p.amount : 1;
    out[unit] = Math.round((p.gramWeight / amount) * 100) / 100;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function normalizeFood(food: FdcFood): FdcMatch {
  const description = (food.description ?? `FDC food ${food.fdcId}`).slice(0, 200);
  const category =
    typeof food.foodCategory === 'string' ? food.foodCategory : (food.foodCategory?.description ?? null);
  const gramsPerUnit = normalizePortions(food.foodPortions);
  return {
    fdcId: food.fdcId,
    description,
    dataType: food.dataType ?? null,
    foodCategory: category || null,
    nutrition: {
      per100g: normalizeNutrients(food.foodNutrients),
      ...(gramsPerUnit && { gramsPerUnit }),
      source: 'fdc',
      fdcId: food.fdcId,
      fdcDescription: description,
    },
  };
}

// ---------------------------------------------------------------------------
// Upstream access: key check, throttle, timeout, error mapping
// ---------------------------------------------------------------------------

let minIntervalMs = DEFAULT_MIN_INTERVAL_MS;
let nextSlotAt = 0;

/** Test hook: reset the throttle window (optionally with a shorter interval). */
export function resetFdcThrottle(intervalMs = DEFAULT_MIN_INTERVAL_MS): void {
  minIntervalMs = intervalMs;
  nextSlotAt = 0;
}

/**
 * Reserve the next upstream slot, waiting if the previous call was under `minIntervalMs` ago.
 * Reservation happens synchronously, so concurrent callers queue rather than burst.
 */
async function throttle(): Promise<void> {
  const now = Date.now();
  const startAt = Math.max(now, nextSlotAt);
  nextSlotAt = startAt + minIntervalMs;
  if (startAt > now) await new Promise((resolve) => setTimeout(resolve, startAt - now));
}

export function isNutritionLookupConfigured(): boolean {
  return Boolean(config.FDC_API_KEY);
}

async function fdcRequest(path: string, init: { method?: string; body?: unknown } = {}): Promise<unknown> {
  const apiKey = config.FDC_API_KEY;
  if (!apiKey) {
    throw new AppError(503, 'Nutrition lookup is not configured on this server (FDC_API_KEY is unset).');
  }
  await throttle();

  let res: Response;
  try {
    res = await fetch(`${FDC_BASE_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'X-Api-Key': apiKey,
        Accept: 'application/json',
        ...(init.body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(FDC_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new AppError(
      502,
      timedOut
        ? 'USDA FoodData Central did not respond in time. Try again, or enter nutrition manually.'
        : 'Could not reach USDA FoodData Central. Try again, or enter nutrition manually.',
    );
  }

  if (!res.ok) {
    if (res.status === 404) throw new AppError(404, 'That food was not found in USDA FoodData Central.');
    const reason =
      res.status === 429
        ? 'its rate limit was reached — try again later'
        : res.status === 401 || res.status === 403
          ? 'the configured API key was rejected'
          : `it returned an error (HTTP ${res.status})`;
    throw new AppError(502, `USDA FoodData Central lookup failed: ${reason}.`);
  }

  try {
    return await res.json();
  } catch {
    throw new AppError(502, 'USDA FoodData Central returned an unreadable response.');
  }
}

/** Search FDC (Foundation + SR Legacy, top 5) and return normalized per-100 g matches. */
export async function searchFoods(query: string): Promise<FdcMatch[]> {
  const data = (await fdcRequest('/foods/search', {
    method: 'POST',
    body: { query, dataType: FDC_DATA_TYPES, pageSize: FDC_SEARCH_PAGE_SIZE },
  })) as FdcSearchResponse;
  const foods = Array.isArray(data?.foods) ? data.foods : [];
  return foods
    .filter((f): f is FdcFood => typeof f?.fdcId === 'number')
    .slice(0, FDC_SEARCH_PAGE_SIZE)
    .map(normalizeFood);
}

/**
 * One FDC food with its portions — search results carry no `foodPortions`, so picking a match
 * fetches the detail to capture `gramsPerUnit` (needed for volume→mass conversion in plan 35).
 */
export async function getFood(fdcId: number): Promise<FdcMatch> {
  const params = new URLSearchParams({ nutrients: DETAIL_NUTRIENT_NUMBERS.join(',') });
  const data = (await fdcRequest(`/food/${fdcId}?${params}`)) as FdcFood;
  if (typeof data?.fdcId !== 'number') {
    throw new AppError(502, 'USDA FoodData Central returned an unexpected response.');
  }
  return normalizeFood(data);
}
