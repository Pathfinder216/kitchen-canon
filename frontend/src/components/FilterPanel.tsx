import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCourses } from '../api/courses';
import { fetchLabels } from '../api/labels';
import { useDietaryTags } from '../hooks/useDietaryTags';
import { useIngredientNames } from '../hooks/useIngredients';
import { ComboInput } from './ComboInput';

interface FilterPanelProps {
  onFilterChange: (filters: {
    includeIngredients?: string;
    excludeIngredients?: string;
    labels?: string;
    diets?: string;
    freeFrom?: string;
    courses?: string;
  }) => void;
}

function IngredientPillInput({
  pills,
  onChange,
  suggestions,
  placeholder,
}: {
  pills: string[];
  onChange: (pills: string[]) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const [activePillIndex, setActivePillIndex] = useState(-1);

  function add(name: string) {
    const t = name.trim().toLowerCase();
    if (!t || pills.includes(t)) { setDraft(''); return; }
    onChange([...pills, t]);
    setDraft('');
    setActivePillIndex(-1);
  }

  function remove(index: number) {
    const newPills = pills.filter((_, i) => i !== index);
    onChange(newPills);
    setActivePillIndex(
      newPills.length === 0 ? -1 : Math.min(index, newPills.length - 1),
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (activePillIndex >= 0) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActivePillIndex(Math.max(0, activePillIndex - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (activePillIndex >= pills.length - 1) {
          setActivePillIndex(-1);
        } else {
          setActivePillIndex(activePillIndex + 1);
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        remove(activePillIndex);
      } else if (e.key === 'Escape') {
        setActivePillIndex(-1);
      } else if (e.key.length === 1) {
        // Printable key — drop back to input and let the character be typed
        setActivePillIndex(-1);
      }
    } else {
      if (e.key === 'ArrowLeft' && draft === '' && pills.length > 0) {
        e.preventDefault();
        setActivePillIndex(pills.length - 1);
      } else if (e.key === 'Backspace' && draft === '' && pills.length > 0) {
        onChange(pills.slice(0, -1));
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded border border-gray-300 px-2 py-1 min-h-[30px] focus-within:ring-1 focus-within:ring-orange-500 focus-within:border-orange-500 bg-white cursor-text">
      {pills.map((p, i) => (
        <span
          key={p}
          className={`flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full shrink-0 transition-colors ${
            i === activePillIndex
              ? 'bg-orange-300 text-orange-900'
              : 'bg-orange-100 text-orange-800'
          }`}
        >
          {p}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); remove(i); }}
            className={`leading-none ml-0.5 ${i === activePillIndex ? 'text-orange-700 hover:text-orange-900' : 'text-orange-500 hover:text-orange-700'}`}
            aria-label={`Remove ${p}`}
          >
            ×
          </button>
        </span>
      ))}
      <ComboInput
        value={draft}
        onChange={(v) => { setDraft(v); if (activePillIndex >= 0) setActivePillIndex(-1); }}
        onSubmit={add}
        onKeyDown={handleKeyDown}
        suggestions={suggestions}
        placeholder={pills.length === 0 ? placeholder : undefined}
        wrapperClassName="flex-1 min-w-[80px]"
        className="border-none shadow-none outline-none focus:ring-0 focus:border-none text-sm py-0 px-0 bg-transparent"
        minInputLength={1}
      />
    </div>
  );
}

export function FilterPanel({ onFilterChange }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [includeIngs, setIncludeIngs] = useState<string[]>([]);
  const [excludeIngs, setExcludeIngs] = useState<string[]>([]);
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: fetchCourses });
  const { data: allLabels } = useQuery({ queryKey: ['labels'], queryFn: () => fetchLabels() });
  const { allergens: ALLERGENS, diets: DIETS, allergenLabels: ALLERGEN_LABELS, dietLabels: DIET_LABELS } = useDietaryTags();
  const ingredientNames = useIngredientNames();

  const otherLabels = allLabels?.filter((l) => l.type === 'manual') ?? [];

  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange({
        includeIngredients: includeIngs.length > 0 ? includeIngs.join(',') : undefined,
        excludeIngredients: excludeIngs.length > 0 ? excludeIngs.join(',') : undefined,
        labels: selectedLabels.length > 0 ? selectedLabels.join(',') : undefined,
        diets: selectedDiets.length > 0 ? selectedDiets.join(',') : undefined,
        freeFrom: selectedAllergens.length > 0 ? selectedAllergens.join(',') : undefined,
        courses: selectedCourses.length > 0 ? selectedCourses.join(',') : undefined,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [includeIngs, excludeIngs, selectedDiets, selectedAllergens, selectedLabels, selectedCourses]);

  function clearFilters() {
    setIncludeIngs([]);
    setExcludeIngs([]);
    setSelectedDiets([]);
    setSelectedAllergens([]);
    setSelectedLabels([]);
    setSelectedCourses([]);
  }

  function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) {
    setter((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  }

  const hasActiveFilters =
    includeIngs.length > 0 ||
    excludeIngs.length > 0 ||
    selectedDiets.length > 0 ||
    selectedAllergens.length > 0 ||
    selectedLabels.length > 0 ||
    selectedCourses.length > 0;

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1"
      >
        Filters {hasActiveFilters && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs">Active</span>}
        <span className="text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg space-y-4">
          {/* Ingredient filters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Must include ingredients</label>
              <IngredientPillInput
                pills={includeIngs}
                onChange={setIncludeIngs}
                suggestions={ingredientNames}
                placeholder="Add ingredient…"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Exclude ingredients</label>
              <IngredientPillInput
                pills={excludeIngs}
                onChange={setExcludeIngs}
                suggestions={ingredientNames}
                placeholder="Add ingredient…"
              />
            </div>
          </div>

          {/* Dietary */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dietary</label>
            <div className="flex flex-wrap gap-1">
              {DIETS.map((diet) => (
                <button
                  key={diet}
                  type="button"
                  onClick={() => toggle(setSelectedDiets, diet)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                    selectedDiets.includes(diet)
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {DIET_LABELS[diet]}
                </button>
              ))}
            </div>
          </div>

          {/* Allergen avoidance */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Free from</label>
            <div className="flex flex-wrap gap-1">
              {ALLERGENS.map((allergen) => (
                <button
                  key={allergen}
                  type="button"
                  onClick={() => toggle(setSelectedAllergens, allergen)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                    selectedAllergens.includes(allergen)
                      ? 'bg-red-100 border-red-300 text-red-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {ALLERGEN_LABELS[allergen]}
                </button>
              ))}
            </div>
          </div>

          {/* Course chips */}
          {courses && courses.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
              <div className="flex flex-wrap gap-1">
                {courses.map((course) => (
                  <button
                    key={course.type}
                    type="button"
                    onClick={() => toggle(setSelectedCourses, course.type)}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                      selectedCourses.includes(course.type)
                        ? 'bg-orange-100 border-orange-300 text-orange-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {course.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Other labels */}
          {otherLabels.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Labels</label>
              <div className="flex flex-wrap gap-1">
                {otherLabels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggle(setSelectedLabels, label.name)}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                      selectedLabels.includes(label.name)
                        ? 'bg-orange-100 border-orange-300 text-orange-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {label.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-gray-500 hover:text-gray-700 px-3 py-1 rounded text-sm border border-gray-300"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
