import { describe, it, expect } from 'vitest';
import {
  computeTimeline,
  intervalsOverlap,
  stepLabel,
  type Timeline,
  type TimelineEntry,
  type TimelineRecipeInput,
  type TimelineStepInput,
} from '../services/timeline.service.js';

const SERVE_AT = new Date('2026-03-14T18:00:00.000Z');
const MIN = 60_000;

/** Minutes relative to serve time (negative = before). */
function offset(d: Date): number {
  return (d.getTime() - SERVE_AT.getTime()) / MIN;
}

let stepSeq = 0;
function step(timeMinutes: number | null, isActiveTime: boolean, instruction = 'Do something'): TimelineStepInput {
  stepSeq += 1;
  return { id: `s${stepSeq}`, instruction, timeMinutes, isActiveTime };
}

function recipe(id: string, steps: TimelineStepInput[], title = id): TimelineRecipeInput {
  return { id, recipeId: `recipe-${id}`, title, steps };
}

function entriesFor(timeline: Timeline, itemId: string): TimelineEntry[] {
  return timeline.entries.filter((e) => e.itemId === itemId).sort((a, b) => a.stepIndex - b.stepIndex);
}

/** The engine's two hard invariants, asserted for any output. */
function assertInvariants(timeline: Timeline, input: TimelineRecipeInput[]) {
  const active = timeline.entries.filter((e) => e.isActive);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const overlap = intervalsOverlap(a.start.getTime(), a.end.getTime(), b.start.getTime(), b.end.getTime());
      expect(overlap, `active overlap: ${a.stepId} [${offset(a.start)},${offset(a.end)}] vs ${b.stepId} [${offset(b.start)},${offset(b.end)}]`).toBe(false);
    }
  }
  for (const r of input) {
    const entries = entriesFor(timeline, r.id);
    expect(entries.map((e) => e.stepId)).toEqual(r.steps.map((s) => s.id));
    for (let i = 0; i < entries.length; i++) {
      expect(entries[i].start.getTime()).toBeLessThanOrEqual(entries[i].end.getTime());
      expect(entries[i].end.getTime()).toBeLessThanOrEqual(SERVE_AT.getTime());
      if (i > 0) expect(entries[i - 1].end.getTime()).toBeLessThanOrEqual(entries[i].start.getTime());
    }
  }
}

describe('computeTimeline', () => {
  it('back-schedules a single recipe so it finishes at serve time', () => {
    const r = recipe('pasta', [step(10, true, 'Chop'), step(12, false, 'Boil'), step(3, true, 'Toss')]);
    const t = computeTimeline([r], SERVE_AT);

    const es = entriesFor(t, 'pasta');
    expect(es.map((e) => [offset(e.start), offset(e.end)])).toEqual([[-25, -15], [-15, -3], [-3, 0]]);
    expect(es.map((e) => e.isActive)).toEqual([true, false, true]);
    expect(offset(t.start)).toBe(-25);
    expect(t.serveAt).toEqual(SERVE_AT);
    expect(t.recipes).toEqual([
      { itemId: 'pasta', recipeId: 'recipe-pasta', title: 'pasta', start: es[0].start, end: SERVE_AT },
    ]);
    expect(t.warnings).toEqual([]);
    expect(t.makeAhead).toEqual([]);
  });

  it('keeps colliding active steps apart and preserves each recipe\'s order', () => {
    const a = recipe('a', [step(20, true), step(10, true)]);
    const b = recipe('b', [step(5, true), step(10, true)]);
    const t = computeTimeline([a, b], SERVE_AT);

    assertInvariants(t, [a, b]);
    // `a` is longer, so it gets serve time and `b` yields.
    expect(entriesFor(t, 'a').map((e) => [offset(e.start), offset(e.end)])).toEqual([[-30, -10], [-10, 0]]);
    expect(entriesFor(t, 'b').map((e) => [offset(e.start), offset(e.end)])).toEqual([[-45, -40], [-40, -30]]);
  });

  it('overlaps a passive-heavy roast with another recipe\'s active prep', () => {
    const roast = recipe('roast', [step(15, true, 'Season'), step(90, false, 'Roast'), step(10, true, 'Carve')]);
    const salad = recipe('salad', [step(10, true, 'Chop'), step(5, true, 'Dress')]);
    const t = computeTimeline([salad, roast], SERVE_AT);

    assertInvariants(t, [salad, roast]);
    const [, roastOven] = entriesFor(t, 'roast');
    for (const e of entriesFor(t, 'salad')) {
      expect(e.start.getTime()).toBeGreaterThanOrEqual(roastOven.start.getTime());
      expect(e.end.getTime()).toBeLessThanOrEqual(roastOven.end.getTime());
    }
    // Whole meal fits in the roast's own duration: nothing starts before the roast.
    expect(offset(t.start)).toBe(-115);
  });

  it('gives untimed steps defaults and warns about them', () => {
    const r = recipe('stew', [step(null, true, 'Brown'), step(null, false, 'Rest'), step(0, true, 'Serve'), step(30, false, 'Simmer')], 'Stew');
    const t = computeTimeline([r], SERVE_AT);

    const es = entriesFor(t, 'stew');
    expect(es.map((e) => offset(e.end) - offset(e.start))).toEqual([5, 0, 5, 30]);
    expect(es.map((e) => e.untimed)).toEqual([true, true, true, false]);
    expect(t.warnings).toHaveLength(1);
    expect(t.warnings[0]).toMatchObject({
      type: 'untimed-steps',
      itemId: 'stew',
      stepIds: [es[0].stepId, es[1].stepId, es[2].stepId],
    });
    expect(t.warnings[0].message).toMatch(/3 untimed steps/);
  });

  it('honours configurable untimed defaults', () => {
    const r = recipe('x', [step(null, true), step(null, false)]);
    const t = computeTimeline([r], SERVE_AT, { defaultActiveMinutes: 8, defaultPassiveMinutes: 2 });
    expect(entriesFor(t, 'x').map((e) => offset(e.end) - offset(e.start))).toEqual([8, 2]);
  });

  it('flags a 12 h brine as make-ahead', () => {
    const brine = step(12 * 60, false, 'Brine the {turkey}');
    const r = recipe('turkey', [step(10, true, 'Mix brine'), brine, step(180, false, 'Roast')], 'Turkey');
    const t = computeTimeline([r], SERVE_AT);

    expect(t.makeAhead).toHaveLength(1);
    expect(t.makeAhead[0]).toMatchObject({
      itemId: 'turkey',
      stepId: brine.id,
      reason: 'long-passive-step',
      leadMinutes: 180 + 720,
    });
    expect(offset(t.makeAhead[0].startBy)).toBe(-900);
    expect(t.makeAhead[0].message).toMatch(/12 h passive step \("Brine the turkey"\).*evening before/);
  });

  it('flags a recipe that must start more than 8 h before serving', () => {
    const r = recipe('bread', [step(230, false), step(60, true), step(230, false)]);
    const t = computeTimeline([r], SERVE_AT);
    expect(t.makeAhead).toHaveLength(1);
    expect(t.makeAhead[0]).toMatchObject({ reason: 'early-start', stepId: null, leadMinutes: 520 });
    expect(t.makeAhead[0].message).toMatch(/earlier in the day/);
  });

  it('does not flag short passive steps or recipes starting within 8 h', () => {
    const r = recipe('ok', [step(239, false), step(10, true)]);
    expect(computeTimeline([r], SERVE_AT).makeAhead).toEqual([]);
  });

  it('warns about recipes with no steps and leaves them off the schedule', () => {
    const t = computeTimeline([recipe('empty', [], 'Bread')], SERVE_AT);
    expect(t.entries).toEqual([]);
    expect(t.start).toEqual(SERVE_AT);
    expect(t.warnings).toEqual([expect.objectContaining({ type: 'no-steps', itemId: 'empty' })]);
    expect(t.recipes[0]).toMatchObject({ start: null, end: null });
  });

  it('schedules the same recipe twice as two independent items', () => {
    const steps = [step(10, true)];
    const t = computeTimeline([{ ...recipe('one', steps), recipeId: 'r' }, { ...recipe('two', steps), recipeId: 'r' }], SERVE_AT);
    expect(t.entries).toHaveLength(2);
    expect(t.entries.map((e) => [offset(e.start), offset(e.end)])).toEqual([[-20, -10], [-10, 0]]);
  });

  it('acceptance: roast + stovetop side + salad produce a sensible schedule', () => {
    const roast = recipe('roast', [
      step(15, true, 'Season the chicken'),
      step(90, false, 'Roast'),
      step(15, false, 'Rest'),
      step(10, true, 'Carve'),
    ], 'Roast chicken');
    const side = recipe('side', [
      step(15, true, 'Peel potatoes'),
      step(20, false, 'Boil potatoes'),
      step(10, true, 'Mash'),
    ], 'Mashed potatoes');
    const salad = recipe('salad', [step(10, true, 'Chop'), step(5, true, 'Dress')], 'Green salad');
    const input = [salad, side, roast];
    const t = computeTimeline(input, SERVE_AT);

    assertInvariants(t, input);
    // Roast is the longest recipe: it is back-scheduled straight from serve time.
    expect(entriesFor(t, 'roast').map((e) => [offset(e.start), offset(e.end)])).toEqual([
      [-130, -115], [-115, -25], [-25, -10], [-10, 0],
    ]);
    expect(t.recipes.find((r) => r.itemId === 'roast')!.start).toEqual(new Date(SERVE_AT.getTime() - 130 * MIN));
    // Salad prep is slotted into the roast's passive window (oven + rest).
    const [, oven, rest] = entriesFor(t, 'roast');
    for (const e of entriesFor(t, 'salad')) {
      expect(e.start.getTime()).toBeGreaterThanOrEqual(oven.start.getTime());
      expect(e.end.getTime()).toBeLessThanOrEqual(rest.end.getTime());
    }
    // Recipes are reported in plan order; entries are chronological.
    expect(t.recipes.map((r) => r.itemId)).toEqual(['salad', 'side', 'roast']);
    const starts = t.entries.map((e) => e.start.getTime());
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(t.makeAhead).toEqual([]);
    expect(t.warnings).toEqual([]);
  });

  describe('property: no active overlap and per-recipe order hold for random inputs', () => {
    // mulberry32 — tiny seeded PRNG so failures are reproducible.
    function prng(seed: number) {
      let a = seed >>> 0;
      return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function runCase(seed: number) {
      const rand = prng(seed);
      const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
      const recipes: TimelineRecipeInput[] = [];
      const recipeCount = int(1, 5);
      for (let r = 0; r < recipeCount; r++) {
        const steps: TimelineStepInput[] = [];
        const stepCount = int(0, 6);
        for (let s = 0; s < stepCount; s++) {
          // Mix of untimed (null / 0), short and very long (fractional) steps.
          const roll = rand();
          const time = roll < 0.15 ? null : roll < 0.2 ? 0 : roll < 0.9 ? int(1, 45) : int(60, 600) + rand();
          steps.push(step(time, rand() < 0.6));
        }
        recipes.push(recipe(`r${r}`, steps));
      }
      const t = computeTimeline(recipes, SERVE_AT);
      assertInvariants(t, recipes);
      expect(t.entries).toHaveLength(recipes.reduce((n, r) => n + r.steps.length, 0));
      // Step durations are preserved (defaults applied to untimed steps).
      for (const r of recipes) {
        entriesFor(t, r.id).forEach((e, i) => {
          const tm = r.steps[i].timeMinutes;
          const expected = tm != null && tm > 0 ? tm : r.steps[i].isActiveTime ? 5 : 0;
          // Dates have millisecond precision, so allow a couple of ms of rounding.
          expect(Math.abs(offset(e.end) - offset(e.start) - expected)).toBeLessThanOrEqual(2 / 60_000);
        });
      }
    }

    it('holds for 300 seeded random meal plans', () => {
      for (let seed = 1; seed <= 300; seed++) {
        try {
          runCase(seed);
        } catch (err) {
          throw new Error(`seed ${seed}: ${(err as Error).message}`, { cause: err });
        }
      }
    });
  });
});

describe('stepLabel', () => {
  it('reduces ingredient refs to their names and collapses whitespace', () => {
    expect(stepLabel('Melt {butter:50%} with\n{sugar}  ')).toBe('Melt butter with sugar');
  });
});
