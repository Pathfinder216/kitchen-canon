import { Modal } from '../ui/Modal';

interface UnclassifiedWarningDialogProps {
  open: boolean;
  ingredients: string[];
  onClose: () => void;
  onSaveAnyway: () => void;
}

export function UnclassifiedWarningDialog({ open, ingredients, onClose, onSaveAnyway }: UnclassifiedWarningDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Unclassified ingredients"
      footer={
        <>
          <button
            type="button"
            onClick={onSaveAnyway}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Save anyway
          </button>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 transition-colors"
          >
            Continue editing
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 mb-3">
        The following ingredients aren't in the catalog. Dietary info may be incomplete.
      </p>
      <ul className="text-sm font-medium text-amber-700 mb-5 space-y-1">
        {ingredients.map((name) => (
          <li key={name}>• {name}</li>
        ))}
      </ul>
    </Modal>
  );
}
