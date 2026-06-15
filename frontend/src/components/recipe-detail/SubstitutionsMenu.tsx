import { Menu, MenuItemButton, MenuItem } from '../ui/Menu';
import type { Substitution } from '../../api/substitutions';

function SwapIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M13.2 2.24a.75.75 0 00.04 1.06l2.1 1.95H6.75a.75.75 0 000 1.5h8.59l-2.1 1.95a.75.75 0 101.02 1.1l3.5-3.25a.75.75 0 000-1.1l-3.5-3.25a.75.75 0 00-1.06.04zm-6.4 8a.75.75 0 00-1.06-.04l-3.5 3.25a.75.75 0 000 1.1l3.5 3.25a.75.75 0 101.02-1.1l-2.1-1.95h8.59a.75.75 0 000-1.5H4.66l2.1-1.95a.75.75 0 00.04-1.06z" clipRule="evenodd" />
    </svg>
  );
}

interface SubstitutionsMenuProps {
  /** The (original) ingredient name this menu substitutes. */
  ingredientName: string;
  /** Substitutions available for this ingredient. */
  availableSubs: Substitution[];
  /** Currently applied substitution, if any. */
  activeSwap: Substitution | undefined;
  /** Apply a substitution (ratio swap is handled by the parent's amount math). */
  onSelect: (sub: Substitution) => void;
  /** Revert to the original ingredient. */
  onRemove: () => void;
}

/** Per-ingredient dropdown for picking a substitution (ratio shown alongside). */
export function SubstitutionsMenu({ ingredientName, availableSubs, activeSwap, onSelect, onRemove }: SubstitutionsMenuProps) {
  return (
    <Menu
      buttonAriaLabel={activeSwap ? `Change substitution for ${ingredientName}` : `Substitute ${ingredientName}`}
      buttonClassName={`inline-flex items-center justify-center rounded transition-colors ${activeSwap
        ? 'text-orange-500 hover:text-orange-600'
        : 'text-gray-400 hover:text-orange-500'
        }`}
      label={<SwapIcon />}
    >
      <p className="px-3 pt-1.5 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
        Sub for {ingredientName}
      </p>
      {availableSubs.map((sub) => (
        <MenuItemButton
          key={sub.id}
          selected={activeSwap?.id === sub.id}
          className="flex items-center justify-between gap-3"
          onClick={() => onSelect(sub)}
        >
          <span>{sub.toIngredient}</span>
          {sub.ratio !== 1 && (
            <span className="text-xs text-gray-400 shrink-0">
              {parseFloat(sub.ratio.toPrecision(4))}×
            </span>
          )}
        </MenuItemButton>
      ))}
      {activeSwap && (
        <div className="border-t border-gray-100 mt-1 pt-1">
          <MenuItem>
            <button
              type="button"
              onClick={onRemove}
              className="block w-full text-left px-3 py-2 text-sm text-gray-400 data-[focus]:bg-gray-50 data-[focus]:text-gray-600"
            >
              Use original
            </button>
          </MenuItem>
        </div>
      )}
    </Menu>
  );
}
