import type { TimelineEntry } from '../types/meal-plan';

/** One color per recipe lane (hex so it can be used for both solid and hatched fills). */
export const RECIPE_COLORS = ['#ea580c', '#0284c7', '#059669', '#7c3aed', '#e11d48', '#d97706', '#0d9488', '#4f46e5'];

export function recipeColor(index: number): string {
  return RECIPE_COLORS[index % RECIPE_COLORS.length];
}

/** CSS background for a timeline block: solid for active steps, hatched for passive ones. */
export function blockBackground(color: string, isActive: boolean): string {
  return isActive
    ? color
    : `repeating-linear-gradient(135deg, ${color}40 0 6px, ${color}14 6px 12px)`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** A Date as the local-time value a `<input type="datetime-local">` expects (YYYY-MM-DDTHH:mm). */
export function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}/;

/**
 * Initial serve time for the picker: the plan's date + time when both are set, the plan's date at
 * 18:00 when only the date is set, otherwise three hours from now (rounded up to 5 minutes).
 */
export function defaultServeAtInput(plan: { date: string | null; time: string | null }, now: Date): string {
  if (plan.date && DATE_RE.test(plan.date)) {
    const time = plan.time && TIME_RE.test(plan.time) ? plan.time.slice(0, 5) : '18:00';
    return `${plan.date}T${time}`;
  }
  const later = new Date(now.getTime() + 3 * 60 * 60_000);
  later.setSeconds(0, 0);
  later.setMinutes(Math.ceil(later.getMinutes() / 5) * 5);
  return toLocalInputValue(later);
}

/** Parse a datetime-local value (interpreted as local time) to an ISO string, or null. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Entries in progress at `now` (start ≤ now < end). */
export function currentEntries(entries: TimelineEntry[], now: Date): TimelineEntry[] {
  const t = now.getTime();
  return entries.filter((e) => Date.parse(e.start) <= t && t < Date.parse(e.end));
}

/** The first entry that starts after `now`, if any (entries are chronological). */
export function nextEntry(entries: TimelineEntry[], now: Date): TimelineEntry | undefined {
  const t = now.getTime();
  return entries.find((e) => Date.parse(e.start) > t);
}

/** "5:40 PM", or "Fri 9:15 PM" when the time falls on a different day than `reference`. */
export function formatClock(iso: string | Date, reference?: Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (reference && !isSameLocalDay(d, reference)) {
    return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
  }
  return time;
}

/** Minutes between two ISO date-times. */
export function minutesBetween(startIso: string, endIso: string): number {
  return (Date.parse(endIso) - Date.parse(startIso)) / 60_000;
}

/** Gutter tick spacing (minutes) that keeps the number of ticks readable for a given span. */
export function tickInterval(spanMinutes: number): number {
  for (const step of [15, 30, 60, 120, 240, 360]) {
    if (spanMinutes / step <= 12) return step;
  }
  return 720;
}

/** Tick times (ms) at round local clock times within [startMs, endMs]. */
export function ticks(startMs: number, endMs: number, stepMinutes: number): number[] {
  const stepMs = stepMinutes * 60_000;
  const tzMs = -new Date(startMs).getTimezoneOffset() * 60_000;
  const result: number[] = [];
  for (let t = Math.ceil((startMs + tzMs) / stepMs) * stepMs - tzMs; t <= endMs; t += stepMs) {
    result.push(t);
  }
  return result;
}
