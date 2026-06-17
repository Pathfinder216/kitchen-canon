import type { InputHTMLAttributes } from 'react';

interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /**
   * Current value as a **string** so the field can be cleared mid-edit — a number-bound
   * input snaps back to the old value (or 0) the instant you delete the last digit.
   */
  value: string;
  /** Receives the raw string. Parse + clamp on submit, falling back to a default for empty/invalid input. */
  onChange: (value: string) => void;
}

/**
 * Empty-able numeric input. Holds its value as a string so the field can be cleared while
 * typing; bind it to string state and parse/clamp the value when you commit (on blur/submit).
 * Shared by the recipe form (servings) and the meal plan form (per-recipe servings).
 */
export function NumberField({ value, onChange, onWheel, ...rest }: NumberFieldProps) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      // Blur on wheel so scrolling over the field never silently changes the value.
      onWheel={(e) => { e.currentTarget.blur(); onWheel?.(e); }}
      {...rest}
    />
  );
}
