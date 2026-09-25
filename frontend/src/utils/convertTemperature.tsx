import type { ReactNode } from 'react';
import type { UnitSystemPreference } from '../api/preferences';

// Render-time temperature conversion in step text (plan 27). Display only — step instructions are
// stored as authored. A detected temperature in the "other" system gets its conversion APPENDED in
// parentheses ("400°F" → "400°F (200°C)") rather than replaced, so a false positive can never
// destroy what the author wrote.

/**
 * A 2–3 digit number (not part of a longer number) followed by either
 *   - a degree marker (`°`, `º`, `degree(s)`, `deg`) and a scale (`F`/`C`/`Fahrenheit`/`Celsius`/
 *     `Centigrade`, any case): `400°F`, `400 °F`, `400 degrees Fahrenheit`, `180 deg C`; or
 *   - a scale letter glued straight onto the number: `200C`, `400F`. This bare form must be an
 *     UPPERCASE letter (checked in code) — `12c` is far more likely a typo'd cup than 12 °C.
 * `step 3 of 4`, `12 cups`, `2 c flour` never match.
 */
const TEMP_PATTERN =
  /(?<![\d.,])(\d{2,3})(?:(?:\s*[°º]\s*|\s*degrees?\s+|\s*deg\.?\s*)(fahrenheit|celsius|centigrade|f|c)|([fc]))\b/gi;

/** Text allowed between two temperatures for them to count as an authored pair: " (", "/", " / ". */
const PAIR_GAP = /^\s*[(/]?\s*$/;

type Scale = 'F' | 'C';

interface TempMatch {
  start: number;
  end: number;
  value: number;
  scale: Scale;
}

function findTemperatures(text: string): TempMatch[] {
  const found: TempMatch[] = [];
  for (const m of text.matchAll(TEMP_PATTERN)) {
    const [full, digits, word, bareLetter] = m;
    if (bareLetter !== undefined && bareLetter !== bareLetter.toUpperCase()) continue;
    const scale = (word ?? bareLetter)[0].toUpperCase() as Scale;
    found.push({ start: m.index, end: m.index + full.length, value: Number(digits), scale });
  }
  return found;
}

/**
 * Convert a temperature to the other scale. Oven-range temperatures round the way oven charts do
 * — nearest 10 °C / 25 °F (400°F → 200°C, 180°C → 350°F) — while lower temperatures (proofing,
 * candy, meat doneness) keep whole-degree precision because a few degrees matter there.
 */
export function convertTemperature(value: number, from: Scale): number {
  if (from === 'F') {
    const c = ((value - 32) * 5) / 9;
    return value >= 250 ? Math.round(c / 10) * 10 : Math.round(c);
  }
  const f = (value * 9) / 5 + 32;
  return value >= 120 ? Math.round(f / 25) * 25 : Math.round(f);
}

interface Insertion {
  /** Offset in the text right after the source temperature. */
  at: number;
  /** e.g. "200°C" */
  label: string;
}

/**
 * Where to append conversions in `text` for `target`. Temperatures already in the target scale are
 * left alone, and so is any temperature the author already paired with its conversion
 * ("400°F (200°C)", "200°C / 400°F") — otherwise we'd print the same conversion twice.
 */
function findInsertions(text: string, target: UnitSystemPreference): Insertion[] {
  if (target === 'original') return [];
  const targetScale: Scale = target === 'metric' ? 'C' : 'F';
  const temps = findTemperatures(text);
  const paired = new Set<number>();
  for (let i = 0; i + 1 < temps.length; i++) {
    const a = temps[i];
    const b = temps[i + 1];
    if (a.scale !== b.scale && PAIR_GAP.test(text.slice(a.end, b.start))) {
      paired.add(i);
      paired.add(i + 1);
    }
  }
  return temps
    .filter((t, i) => t.scale !== targetScale && !paired.has(i))
    .map((t) => ({ at: t.end, label: `${convertTemperature(t.value, t.scale)}°${targetScale}` }));
}

/**
 * Plain-text form: "Heat oven to 400°F" → "Heat oven to 400°F (200°C)" for a metric user.
 * `original` returns the text unchanged.
 */
export function annotateTemperaturesText(text: string, target: UnitSystemPreference): string {
  const insertions = findInsertions(text, target);
  let out = '';
  let last = 0;
  for (const { at, label } of insertions) {
    out += `${text.slice(last, at)} (${label})`;
    last = at;
  }
  return out + text.slice(last);
}

/**
 * React-node form of `annotateTemperaturesText`: the appended conversions are styled spans so
 * they read as an annotation. `keyPrefix` keeps span keys unique when the caller splices several
 * annotated segments into one children array.
 */
export function annotateTemperatures(
  text: string,
  target: UnitSystemPreference,
  keyPrefix = 'temp',
): ReactNode[] {
  const insertions = findInsertions(text, target);
  if (insertions.length === 0) return [text];
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const { at, label } of insertions) {
    nodes.push(`${text.slice(last, at)} `);
    nodes.push(
      <span key={`${keyPrefix}-${at}`} className="text-gray-500 font-medium" data-converted-temperature="">
        ({label})
      </span>,
    );
    last = at;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
