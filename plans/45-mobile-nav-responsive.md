# 45 — Responsive mobile navigation

**Size:** S-M | **Depends on:** — | **Blocks:** —

## Goal
The top navigation in `frontend/src/layouts/AppLayout.tsx` is a single non-wrapping flex row:
the logo, five nav links (`Recipes`, `Meal Plans`, `Substitutions`, `Ingredients`, `Import`), the
user email, and `Log out`. On phone-width viewports the links overflow past the right edge of the
screen — they're clipped and become invisible/unclickable. Make the navigation usable on mobile
without regressing the desktop layout.

## Implementation

1. In `AppLayout.tsx`, keep the current horizontal nav for `sm`+ breakpoints, but add a mobile
   layout below `sm`. The simplest robust fix is a hamburger toggle:
   - Add `const [menuOpen, setMenuOpen] = useState(false)` and a menu button shown only on small
     screens (`sm:hidden`), with the inline link row hidden on small screens (`hidden sm:flex`).
   - When open, render the `navItems` (and the `Log out` action) as a stacked, full-width vertical
     list below the header bar. Close the menu on navigation (e.g. an `onClick={() => setMenuOpen(false)}`
     on each `Link`, or close on `location.pathname` change via `useEffect`).
   - The user email (`hidden sm:inline` today) can stay desktop-only or move into the open menu.
2. Ensure nothing overflows even when the menu is closed: the header's inner container already uses
   `max-w-5xl mx-auto px-4`; the collapsed mobile bar should only hold the logo + the toggle button,
   so there is nothing left to clip.
3. Preserve the active-route highlight logic (the `item.path === '/' ? ... : startsWith(...)`
   ternary) in both layouts — factor the link into a small local helper or map so the className
   logic isn't duplicated/diverging.
4. Accessibility: the toggle button needs `aria-label` (e.g. "Toggle navigation menu"),
   `aria-expanded={menuOpen}`, and `aria-controls` pointing at the menu container's `id`. If
   plan 05's Headless UI primitives have already landed, prefer its `Menu` primitive over a
   hand-rolled toggle; otherwise a plain `useState` toggle is acceptable here.

## Acceptance
- At a 375px-wide viewport, every nav destination (`Recipes`, `Meal Plans`, `Substitutions`,
  `Ingredients`, `Import`) and `Log out` is reachable and clickable; nothing is clipped by the
  screen edge.
- The desktop (`sm`+) layout is visually unchanged from today.
- The active-route highlight still works in both layouts; opening a link closes the mobile menu.
- An RTL test in `frontend/src/` (rendered via the shared provider helper, `src/test/utils.tsx`)
  asserts the toggle reveals the nav links. All frontend tests green and `npm run build` succeeds.
