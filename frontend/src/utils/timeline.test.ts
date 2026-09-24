import {
  currentEntries,
  defaultServeAtInput,
  localInputToIso,
  nextEntry,
  tickInterval,
  ticks,
  toLocalInputValue,
} from './timeline';
import type { TimelineEntry } from '../types/meal-plan';

function entry(stepId: string, start: string, end: string): TimelineEntry {
  return { itemId: 'i', recipeId: 'r', stepId, stepIndex: 0, start, end, isActive: true, untimed: false, label: stepId };
}

describe('defaultServeAtInput', () => {
  const now = new Date(2026, 2, 14, 12, 7); // local 12:07

  it('uses the plan date and time when both are set', () => {
    expect(defaultServeAtInput({ date: '2026-04-01', time: '19:30' }, now)).toBe('2026-04-01T19:30');
  });

  it('falls back to 18:00 on the plan date when only the date is set', () => {
    expect(defaultServeAtInput({ date: '2026-04-01', time: null }, now)).toBe('2026-04-01T18:00');
  });

  it('defaults to three hours from now, rounded up to 5 minutes', () => {
    expect(defaultServeAtInput({ date: null, time: null }, now)).toBe('2026-03-14T15:10');
  });
});

describe('local input conversion', () => {
  it('round-trips a local date-time', () => {
    const d = new Date(2026, 0, 5, 8, 4);
    expect(toLocalInputValue(d)).toBe('2026-01-05T08:04');
    expect(localInputToIso('2026-01-05T08:04')).toBe(d.toISOString());
  });

  it('returns null for an empty or invalid value', () => {
    expect(localInputToIso('')).toBeNull();
    expect(localInputToIso('nope')).toBeNull();
  });
});

describe('current / next entry', () => {
  const entries = [
    entry('a', '2026-03-14T17:00:00Z', '2026-03-14T17:30:00Z'),
    entry('b', '2026-03-14T17:20:00Z', '2026-03-14T17:40:00Z'),
    entry('c', '2026-03-14T17:45:00Z', '2026-03-14T18:00:00Z'),
  ];

  it('finds entries in progress (end exclusive)', () => {
    expect(currentEntries(entries, new Date('2026-03-14T17:25:00Z')).map((e) => e.stepId)).toEqual(['a', 'b']);
    expect(currentEntries(entries, new Date('2026-03-14T17:30:00Z')).map((e) => e.stepId)).toEqual(['b']);
    expect(currentEntries(entries, new Date('2026-03-14T17:42:00Z'))).toEqual([]);
  });

  it('finds the next entry to start', () => {
    expect(nextEntry(entries, new Date('2026-03-14T17:25:00Z'))?.stepId).toBe('c');
    expect(nextEntry(entries, new Date('2026-03-14T17:50:00Z'))).toBeUndefined();
  });
});

describe('ticks', () => {
  it('keeps the tick count readable', () => {
    expect(tickInterval(60)).toBe(15);
    expect(tickInterval(200)).toBe(30);
    expect(tickInterval(900)).toBe(120);
  });

  it('places ticks on round local clock times', () => {
    const start = new Date(2026, 2, 14, 16, 50).getTime();
    const end = new Date(2026, 2, 14, 18, 0).getTime();
    expect(ticks(start, end, 30).map((t) => toLocalInputValue(new Date(t)).slice(11))).toEqual(['17:00', '17:30', '18:00']);
  });
});
