import { useEffect, useState } from 'react';
import { NumberField } from '../ui/NumberField';

interface ServingScalerProps {
  /** The recipe's base servings — used for the multiplier note. */
  baseServings: number;
  targetServings: number;
  setTargetServings: (n: number) => void;
}

/** Servings stepper input plus the "(×N)" multiplier note. `useScaling` lives in the parent. */
export function ServingScaler({ baseServings, targetServings, setTargetServings }: ServingScalerProps) {
  // Local empty-able draft so the field can be cleared while typing; the committed value
  // (which drives live scaling) stays a number in the parent.
  const [draft, setDraft] = useState(String(targetServings));

  // Re-sync when the value changes from outside (the +/- buttons, or navigation).
  useEffect(() => { setDraft(String(targetServings)); }, [targetServings]);

  function handleChange(value: string) {
    setDraft(value);
    const n = parseInt(value, 10);
    // Only commit a valid scale; leave the last value in place while the field is blank/invalid.
    if (Number.isFinite(n) && n >= 1) setTargetServings(Math.min(999, n));
  }

  function handleBlur() {
    // Empty/invalid on blur → restore the committed value in the field.
    if (!/^\d+$/.test(draft)) setDraft(String(targetServings));
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="servings-scale" className="text-sm text-gray-600">
        Servings:
      </label>
      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
        <button
          onClick={() => setTargetServings(Math.max(1, targetServings - 1))}
          className="w-8 py-1 text-gray-600 hover:bg-gray-100 text-sm font-bold"
          aria-label="Decrease servings"
        >
          −
        </button>
        <NumberField
          id="servings-scale"
          min={1}
          max={999}
          value={draft}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-12 text-center text-sm py-1 focus:outline-none border-x border-gray-300"
        />
        <button
          onClick={() => setTargetServings(targetServings + 1)}
          className="w-8 py-1 text-gray-600 hover:bg-gray-100 text-sm font-bold"
          aria-label="Increase servings"
        >
          +
        </button>
      </div>
      <span className="text-xs text-orange-600 w-14 shrink-0 text-left whitespace-nowrap">
        {targetServings !== baseServings && `(×${(targetServings / baseServings).toFixed(2).replace(/\.?0+$/, '')})`}
      </span>
    </div>
  );
}
