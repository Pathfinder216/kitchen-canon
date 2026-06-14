import { Menu as HMenu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import type { ComponentProps, ReactNode } from 'react';

interface MenuProps {
  /** Trigger content (e.g. an icon). */
  label: ReactNode;
  buttonClassName?: string;
  buttonAriaLabel?: string;
  /** Floating-UI anchor; defaults to bottom-left. Renders in a portal so it
   *  escapes `overflow` clipping from scroll containers. */
  anchor?: ComponentProps<typeof MenuItems>['anchor'];
  /** Extra classes for the items panel. */
  className?: string;
  children: ReactNode;
}

const ITEMS_BASE =
  'z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-44 py-1 focus:outline-none [--anchor-gap:4px]';

/**
 * Accessible dropdown menu built on Headless UI's `Menu`. Handles keyboard
 * navigation, Escape-to-close, outside-click-to-close, and focus return — and
 * portals the panel so it isn't clipped by scroll containers. Compose rows with
 * `MenuItemButton`, or drop to the re-exported `MenuItem` for custom markup.
 */
export function Menu({
  label,
  buttonClassName,
  buttonAriaLabel,
  anchor = 'bottom start',
  className,
  children,
}: MenuProps) {
  return (
    <HMenu>
      <MenuButton className={buttonClassName} aria-label={buttonAriaLabel}>
        {label}
      </MenuButton>
      <MenuItems anchor={anchor} className={`${ITEMS_BASE} ${className ?? ''}`}>
        {children}
      </MenuItems>
    </HMenu>
  );
}

interface MenuItemButtonProps {
  onClick: () => void;
  /** Applies the active/selected highlight independent of keyboard focus. */
  selected?: boolean;
  className?: string;
  children: ReactNode;
}

/** A styled `MenuItem` row. Keyboard/pointer focus highlights via `data-focus`. */
export function MenuItemButton({ onClick, selected = false, className = '', children }: MenuItemButtonProps) {
  return (
    <MenuItem>
      <button
        type="button"
        onClick={onClick}
        className={`block w-full text-left px-3 py-2 text-sm data-[focus]:bg-gray-50 ${
          selected ? 'text-orange-600 bg-orange-50' : 'text-gray-700'
        } ${className}`}
      >
        {children}
      </button>
    </MenuItem>
  );
}

export { MenuItem };
