/**
 * Format a minute count as a human-friendly duration.
 *
 * 135 → "2 h 15 min"; 90 → "1 h 30 min"; 45 → "45 min"; 60 → "1 h";
 * null / undefined / 0 → "". Fractional minutes (step times are floats)
 * are rounded to the nearest minute for display.
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '';
  const total = Math.round(minutes);
  if (total <= 0) return '';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
