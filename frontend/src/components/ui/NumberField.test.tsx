import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { NumberField, type NumberFieldMode } from './NumberField';

/** Controlled host so multi-keystroke typing accumulates (the real consumers own the state). */
function ControlledField({ mode, onChange }: { mode?: NumberFieldMode; onChange?: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <NumberField
      mode={mode}
      value={value}
      onChange={(v) => { setValue(v); onChange?.(v); }}
      aria-label="amt"
    />
  );
}

describe('NumberField', () => {
  it('defaults to an integer number input with a numeric keypad', () => {
    render(<NumberField value="2" onChange={vi.fn()} aria-label="qty" />);
    const input = screen.getByLabelText('qty') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.inputMode).toBe('numeric');
  });

  it('decimal mode keeps a number input but hints a decimal keypad', () => {
    render(<NumberField mode="decimal" value="1.5" onChange={vi.fn()} aria-label="ratio" />);
    const input = screen.getByLabelText('ratio') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.inputMode).toBe('decimal');
  });

  it('fraction mode is a text input that accepts slash fractions', async () => {
    const user = userEvent.setup();
    render(<ControlledField mode="fraction" />);
    const input = screen.getByLabelText('amt') as HTMLInputElement;
    expect(input.type).toBe('text');

    await user.type(input, '1 1/2');
    expect(input.value).toBe('1 1/2');
  });

  it('fraction mode rejects letters (keystroke is dropped)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledField mode="fraction" onChange={onChange} />);

    await user.type(screen.getByLabelText('amt'), 'a');
    expect(onChange).not.toHaveBeenCalled();
    expect((screen.getByLabelText('amt') as HTMLInputElement).value).toBe('');
  });

  it('can be cleared to an empty string (no snap-back)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField value="3" onChange={onChange} aria-label="qty" />);

    await user.clear(screen.getByLabelText('qty'));
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
