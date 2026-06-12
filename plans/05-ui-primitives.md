# 05 — Shared accessible Modal + Menu primitives (Headless UI)

**Size:** S-M | **Depends on:** 01 | **Blocks:** 06–09 (decompositions), 26 (image crop)

## Goal
The app's overlays are hand-rolled `div` stacks with no focus trap, no Escape handling, no
ARIA. Adopt `@headlessui/react` (decision already made) and extract two shared primitives that
every overlay then uses.

## Implementation

1. `npm install @headlessui/react --prefix frontend`.
2. Create `frontend/src/components/ui/Modal.tsx` wrapping Headless UI `Dialog` +
   `DialogPanel`/`DialogTitle`: props `{ open, onClose, title?, children, footer? }`, styled to
   match the existing overlays (`bg-black/40` backdrop, white rounded panel — copy the look
   from `RecipeForm.tsx:680-710`, the unclassified-ingredients warning dialog).
3. Create `frontend/src/components/ui/Menu.tsx` wrapping Headless UI `Menu` (button + items)
   with the styling of the substitutions dropdown in `RecipeDetailPage.tsx:401-437`.
4. Migrate every existing overlay to the primitives. Find them with
   `grep -rn "bg-black/40\|absolute inset-0" frontend/src` — known instances: the RecipeForm
   unclassified warning (`RecipeForm.tsx:680`), the RecipeDetailPage confirm dialog
   (`RecipeDetailPage.tsx:203-228`) and substitutions dropdown (`:401-437`). Migrate any others
   the grep reveals. Behavior must be identical plus: Escape closes, focus is trapped, focus
   returns to the trigger on close.
5. RTL tests for both primitives (open/close, Escape, focus trap via `userEvent.tab()`), and
   confirm the existing RecipeForm/CookModePage suites still pass unchanged.

## Acceptance
- No hand-rolled overlay/backdrop divs remain outside `components/ui/`.
- Keyboard: Escape closes any dialog/menu; Tab cycles within an open dialog.
- All frontend tests green.
