# 07 — Decompose CookModePage.tsx

**Size:** M | **Depends on:** 01 (05 not strictly needed — cook mode has no overlays)

## Goal
`frontend/src/pages/CookModePage.tsx` (546 lines) mixes a complete timer system with step
rendering and navigation. Extract the timer system and the step UI. Zero behavior change; the
11 CookModePage tests are the net.

## Target structure

```
pages/CookModePage.tsx        (~150 lines: data loading, recipe switching, navigation)
hooks/useStepTimers.ts        (timer state machine: start/pause/resume/reset/dismiss,
                               remaining-seconds ticking, completion detection)
components/cook-mode/
  TimerPanel.tsx              (the floating running-timers panel)
  StepTimerControls.tsx       (per-step start/resume UI incl. editable mins/secs inputs)
  StepCard.tsx                (instruction with resolveIngredientRefs, time caption, StepMedia)
  IngredientChecklist.tsx     (the checkbox list)
```

## Approach

1. The timer system is self-contained at `CookModePage.tsx:72-340`: `formatTime` (:72), the
   per-step timer card (:102-193 incl. the editable `mins`/`secs` inputs at :168 and
   start/resume at :171), the running panel (:~200-340), and the Web Audio completion beep
   (:47-67). Move the state + ticking + audio into `useStepTimers` keyed by step index; the
   components consume it.
2. `formatTime` moves to the hook module and is exported (plan 12 reuses the idea but for
   minutes-granularity durations — different function, don't merge them).
3. Step rendering (instruction + `resolveIngredientRefs` + `10 min (active|passive)` caption at
   :456-473 + media) becomes `StepCard`; the checklist at :494-520 becomes
   `IngredientChecklist`; keep checked-state in the page (it's per-recipe-session).
4. The timer tests cover persistence across step navigation, pause/resume, dismiss — run the
   suite after each extraction. Add direct hook tests for `useStepTimers` with
   `vi.useFakeTimers()`: tick-down, completion fires audio callback, independent timers on two
   steps.

## Acceptance
- All 11 existing CookModePage tests pass unchanged; new `useStepTimers` tests added.
- Page file ≤ ~200 lines; timers behave identically (start on step, navigate away, panel keeps
  counting, beep on completion).
