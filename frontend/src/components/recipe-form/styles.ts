// Shared Tailwind class strings for the recipe-form editors.
// base: no width, so narrow inputs can specify their own
export const base = 'rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500';
export const inputClass = `${base} w-full`;
export const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
export const gripClass = 'cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 touch-none select-none px-0.5';

export const FLIP_TRANSITION = 'transform 320ms cubic-bezier(0.33, 1, 0.68, 1)';

/** Prevent mouse scroll from changing number input values */
export function noScroll(e: React.WheelEvent<HTMLInputElement>) {
  (e.currentTarget as HTMLInputElement).blur();
}
