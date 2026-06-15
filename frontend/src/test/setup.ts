import '@testing-library/jest-dom/vitest';

// Floating UI (Headless UI's anchored menus) sets up a ResizeObserver, which
// jsdom doesn't implement. Provide a no-op so anchored menus render in tests.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
