import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCourses } from '../api/courses';
import { fetchLabels } from '../api/labels';
import { ALLERGENS, ALLERGEN_LABELS, DIETS, DIET_LABELS } from '../constants/dietaryTags';

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

export function FilterPanel({ onFilterChange }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [includeIng, setIncludeIng] = useState('');
  const [excludeIng, setExcludeIng] = useState('');
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: fetchCourses });
  const { data: allLabels } = useQuery({ queryKey: ['labels'], queryFn: () => fetchLabels() });

  const otherLabels = allLabels?.filter((l) => l.type === 'manual') ?? [];

  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange({
        includeIngredients: includeIng || undefined,
        excludeIngredients: excludeIng || undefined,
        labels: selectedLabels.length > 0 ? selectedLabels.join(',') : undefined,
        diets: selectedDiets.length > 0 ? selectedDiets.join(',') : undefined,
        freeFrom: selectedAllergens.length > 0 ? selectedAllergens.join(',') : undefined,
        courses: selectedCourses.length > 0 ? selectedCourses.join(',') : undefined,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [includeIng, excludeIng, selectedDiets, selectedAllergens, selectedLabels, selectedCourses]);

  function clearFilters() {
    setIncludeIng('');
    setExcludeIng('');
    setSelectedDiets([]);
    setSelectedAllergens([]);
    setSelectedLabels([]);
    setSelectedCourses([]);
  }

  function toggle<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, value: T) {
    setter((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  }

  const hasActiveFilters =
    includeIng ||
    excludeIng ||
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
              <input
                type="text"
                value={includeIng}
                onChange={(e) => setIncludeIng(e.target.value)}
                placeholder="e.g., chicken, rice"
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Exclude ingredients</label>
              <input
                type="text"
                value={excludeIng}
                onChange={(e) => setExcludeIng(e.target.value)}
                placeholder="e.g., mushrooms"
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
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

          {/* Other labels (equipment, makeAhead, etc.) */}
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
