import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional heading rendered as the accessible dialog title. */
  title?: ReactNode;
  children: ReactNode;
  /** Optional footer; rendered as a right-aligned button row. */
  footer?: ReactNode;
  /**
   * Overrides the panel styling. Defaults to the small confirm-dialog look
   * (`max-w-sm` white rounded card). Pass a custom value for larger modals.
   */
  panelClassName?: string;
}

const DEFAULT_PANEL = 'relative bg-white rounded-xl shadow-xl p-6 mx-4 max-w-sm w-full';

/**
 * Accessible modal dialog built on Headless UI's `Dialog`. Provides a focus
 * trap, Escape-to-close, backdrop-click-to-close, and focus return to the
 * trigger — none of which the previous hand-rolled overlays had.
 */
export function Modal({ open, onClose, title, children, footer, panelClassName }: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel className={panelClassName ?? DEFAULT_PANEL}>
          {title && (
            <DialogTitle className="text-lg font-semibold text-gray-900 mb-2">{title}</DialogTitle>
          )}
          {children}
          {footer && <div className="flex justify-end gap-3">{footer}</div>}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
