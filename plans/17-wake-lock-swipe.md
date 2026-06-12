# 17 — Cook mode: screen wake lock + swipe navigation

**Size:** S-M | **Depends on:** 07 if landed (edit the decomposed page), otherwise CookModePage directly

## Goal
Spec §5: prevent the phone sleeping during cooking, and navigate steps by swipe. Neither exists
(`navigator.wakeLock` appears nowhere in the codebase).

## Implementation

### Wake lock
1. `frontend/src/hooks/useWakeLock.ts`:
   - On mount: `navigator.wakeLock?.request('screen')` inside try/catch (API requires a secure
     context or localhost — on plain-HTTP LAN it will throw; catch and expose
     `supported: false` rather than crashing).
   - Re-acquire on `visibilitychange` → `visible` (the lock auto-releases when the tab hides).
   - Release on unmount.
2. Use it in CookModePage only. Show a subtle one-line notice when unsupported/failed:
   "Screen may sleep — wake lock unavailable on this connection." (On the Pi's HTTP deploy this
   will be the common case; the message tells the user why. Note it in the PR: HTTPS would fix
   it.)
3. Test: jsdom has no wakeLock — mock `navigator.wakeLock` and assert request on mount,
   re-request on visibilitychange, release on unmount.

### Swipe navigation
4. No new dependency: a small `useSwipe` hook on the step-card container using
   `onTouchStart`/`onTouchEnd` deltas — horizontal displacement > 60px with vertical drift
   < 40px → next/prev step. Wire to the same handlers as the Prev/Next buttons
   (`CookModePage.tsx:543-584`); respect existing first/last-step bounds.
5. Guard against swipe-vs-scroll conflicts: the threshold above plus ignoring multi-touch is
   sufficient; don't preventDefault on touchmove (keeps vertical scrolling native).
6. Test: fire `touchStart`/`touchEnd` events with synthetic coordinates → step advances;
   vertical-dominant gesture does not navigate.

## Acceptance
On a phone: screen stays awake in cook mode (HTTPS/localhost), swiping left/right changes
steps, buttons still work; spec §8 status updated.
