import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ServingScaler } from './ServingScaler';

// Wrap in a host that owns the numeric target-servings state, mirroring `useScaling`.
function Host({ onCommit }: { onCommit: (n: number) => void }) {
  const [target, setTarget] = useState(4);
  return (
    <ServingScaler
      baseServings={4}
      targetServings={target}
      setTargetServings={(n) => { setTarget(n); onCommit(n); }}
    />
  );
}

describe('ServingScaler', () => {
  it('can be cleared mid-edit without snapping back, then commits a typed value', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Host onCommit={onCommit} />);

    const input = screen.getByLabelText('Servings:') as HTMLInputElement;
    await user.clear(input);
    // Field stays empty — it does not snap back to 1.
    expect(input.value).toBe('');

    await user.type(input, '8');
    expect(input.value).toBe('8');
    expect(onCommit).toHaveBeenLastCalledWith(8);
  });

  it('restores the committed value when left empty on blur', async () => {
    const user = userEvent.setup();
    render(<Host onCommit={vi.fn()} />);

    const input = screen.getByLabelText('Servings:') as HTMLInputElement;
    await user.clear(input);
    await user.tab();
    expect(input.value).toBe('4');
  });
});
