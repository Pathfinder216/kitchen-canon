import { Modal } from '../ui/Modal';

interface OverRefWarningDialogProps {
  open: boolean;
  ingredients: string[];
  onClose: () => void;
  onSaveAnyway: () => void;
}

export function OverRefWarningDialog({ open, ingredients, onClose, onSaveAnyway }: OverRefWarningDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ingredient references exceed 100%"
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
        The following ingredients are referenced for more than their total amount across all steps:
      </p>
      <ul className="text-sm font-medium text-red-700 mb-5 space-y-1">
        {ingredients.map((label) => (
          <li key={label}>• {label}</li>
        ))}
      </ul>
    </Modal>
  );
}

interface UnderRefInfoDialogProps {
  open: boolean;
  ingredients: string[];
  noRefsUsedAtAll: boolean;
  onClose: () => void;
  onSaveAnyway: () => void;
}

export function UnderRefInfoDialog({ open, ingredients, noRefsUsedAtAll, onClose, onSaveAnyway }: UnderRefInfoDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={noRefsUsedAtAll ? 'No ingredient references used' : "Some ingredients aren't fully referenced"}
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
      {noRefsUsedAtAll ? (
        <p className="text-sm text-gray-600 mb-5">
          When you use ingredient references in the steps (see the buttons below the step text field), the step description will list the ingredient by name and amount, scaled based on serving size. This is helpful when cooking. Please consider using this feature!
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-3">
            The following ingredients are referenced for less than 100% of their amount across all steps:
          </p>
          <ul className="text-sm font-medium text-gray-700 mb-5 space-y-1">
            {ingredients.map((label) => (
              <li key={label}>• {label}</li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
