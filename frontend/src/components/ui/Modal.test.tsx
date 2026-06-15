import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

function renderModal(props: Partial<Parameters<typeof Modal>[0]> = {}) {
  return render(
    <Modal open onClose={vi.fn()} title="My Dialog" {...props}>
      <p>Body content</p>
    </Modal>,
  );
}

describe('Modal', () => {
  it('renders title and children when open', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('My Dialog')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Body content')).not.toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus inside the dialog (Tab cycles)', async () => {
    const user = userEvent.setup();
    render(
      <Modal
        open
        onClose={vi.fn()}
        title="Confirm"
        footer={
          <>
            <button>First</button>
            <button>Second</button>
          </>
        }
      >
        <p>Body</p>
      </Modal>,
    );

    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });

    first.focus();
    await user.tab();
    expect(second).toHaveFocus();

    // Tabbing past the last focusable element wraps back into the dialog,
    // never escaping to document.body.
    await user.tab();
    expect(document.body).not.toHaveFocus();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement);
  });
});
