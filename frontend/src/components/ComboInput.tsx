import { useState, useRef, useEffect } from 'react';

interface ComboInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  /** Classes for the wrapper div (use for layout: flex-1, w-20, etc.) */
  wrapperClassName?: string;
  /** Classes for the input element (use for visual styles) */
  className?: string;
  id?: string;
  required?: boolean;
  /** Minimum input length before suggestions appear. Default 1. Pass 0 to show all on focus. */
  minInputLength?: number;
}

export function ComboInput({
  value,
  onChange,
  suggestions,
  placeholder,
  wrapperClassName,
  className,
  id,
  required,
  minInputLength = 1,
}: ComboInputProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = value.length >= minInputLength
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : minInputLength === 0 ? suggestions.slice(0, 8) : [];

  const showDropdown = open && filtered.length > 0;

  function select(suggestion: string) {
    onChange(suggestion);
    setOpen(false);
    setHighlighted(0);
  }

  function closeDropdown() {
    setOpen(false);
    setHighlighted(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      closeDropdown();
      return;
    }
    if (!showDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Tab') {
      if (!e.shiftKey && highlighted >= 0) {
        // Select highlighted suggestion and move to next field
        select(filtered[highlighted]);
      } else {
        // No selection or Shift+Tab: just close and let browser move focus
        closeDropdown();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0) select(filtered[highlighted]);
    }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (showDropdown && listRef.current && highlighted >= 0) {
      const item = listRef.current.children[highlighted] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlighted, showDropdown]);

  return (
    <div ref={containerRef} className={`relative ${wrapperClassName ?? ''}`}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlighted(0); }}
        onFocus={() => { if (filtered.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full ${className ?? ''}`}
        required={required}
        autoComplete="off"
      />
      {showDropdown && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 top-full mt-0.5 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto w-max min-w-full"
        >
          {filtered.map((s, i) => (
            <li
              key={s}
              onMouseDown={(e) => { e.preventDefault(); select(s); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`px-3 py-1.5 text-sm cursor-pointer whitespace-nowrap ${i === highlighted ? 'bg-orange-50 text-orange-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
