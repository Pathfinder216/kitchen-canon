interface ServingScalerProps {
  /** The recipe's base servings — used for the multiplier note. */
  baseServings: number;
  targetServings: number;
  setTargetServings: (n: number) => void;
}

/** Servings stepper input plus the "(×N)" multiplier note. `useScaling` lives in the parent. */
export function ServingScaler({ baseServings, targetServings, setTargetServings }: ServingScalerProps) {
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
        <input
          id="servings-scale"
          type="number"
          min={1}
          max={999}
          value={targetServings}
          onChange={(e) => setTargetServings(Math.max(1, Number(e.target.value)))}
          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
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
