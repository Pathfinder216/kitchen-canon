import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSubstitutions,
  createSubstitution,
  deleteSubstitution,
  type Substitution,
} from '../api/substitutions';
import { ComboInput } from '../components/ComboInput';
import { INGREDIENT_SUGGESTIONS } from '../constants/suggestions';

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  );
}

function formatRatio(ratio: number): string {
  if (ratio === 1) return '';
  const rounded = parseFloat(ratio.toPrecision(4));
  return `use ${rounded}× the amount`;
}

export function SubstitutionsPage() {
  const queryClient = useQueryClient();
  const { data: subs = [], isLoading } = useQuery({
    queryKey: ['substitutions'],
    queryFn: () => fetchSubstitutions(),
  });

  const createMutation = useMutation({
    mutationFn: createSubstitution,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      setForm({ fromIngredient: '', toIngredient: '', ratio: '1', notes: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubstitution,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['substitutions'] }),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    fromIngredient: '',
    toIngredient: '',
    ratio: '1',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');

  const emptyForm = { fromIngredient: '', toIngredient: '', ratio: '1', notes: '' };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.fromIngredient.trim() || !form.toIngredient.trim()) {
      setFormError('Both ingredient fields are required.');
      return;
    }
    const ratio = parseFloat(form.ratio);
    if (isNaN(ratio) || ratio <= 0) {
      setFormError('Amount must be a positive number.');
      return;
    }
    createMutation.mutate({
      fromIngredient: form.fromIngredient.trim(),
      toIngredient: form.toIngredient.trim(),
      ratio,
      notes: form.notes.trim() || undefined,
    });
  };

  const handleCancel = () => {
    setFormOpen(false);
    setFormError('');
    setForm(emptyForm);
  };

  const searchLower = search.toLowerCase();
  const filtered = search
    ? subs.filter(
        (s) =>
          s.fromIngredient.includes(searchLower) ||
          s.toIngredient.includes(searchLower),
      )
    : subs;

  const grouped = new Map<string, Substitution[]>();
  for (const sub of filtered) {
    if (!grouped.has(sub.fromIngredient)) grouped.set(sub.fromIngredient, []);
    grouped.get(sub.fromIngredient)!.push(sub);
  }

  const inputBase =
    'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ingredient Substitutions</h1>
        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 transition-colors"
          >
            + Add Substitution
          </button>
        )}
      </div>

      {/* Collapsible add form */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: formOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-1">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Add Substitution</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instead of</label>
                  <ComboInput
                    value={form.fromIngredient}
                    onChange={(v) => setForm((f) => ({ ...f, fromIngredient: v }))}
                    suggestions={INGREDIENT_SUGGESTIONS}
                    placeholder="e.g. butter"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Use</label>
                  <ComboInput
                    value={form.toIngredient}
                    onChange={(v) => setForm((f) => ({ ...f, toIngredient: v }))}
                    suggestions={INGREDIENT_SUGGESTIONS}
                    placeholder="e.g. coconut oil"
                    className={inputBase}
                  />
                </div>
              </div>

              {/* Amount */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Use</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.ratio}
                  onChange={(e) => setForm((f) => ({ ...f, ratio: e.target.value }))}
                  className="w-20 border border-gray-300 rounded-md px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <span className="text-sm text-gray-600">times the amount</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. works best in baking"
                  className={inputBase}
                />
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}
              {createMutation.isError && (
                <p className="text-sm text-red-600">Failed to save. Please try again.</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Adding...' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-sm font-medium px-4 py-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search substitutions..."
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
      />

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : grouped.size === 0 ? (
        <p className="text-sm text-gray-500">
          {search ? 'No substitutions match your search.' : 'No substitutions yet.'}
        </p>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([ingredient, list]) => (
            <div key={ingredient} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-700">
                  Instead of <span className="text-gray-900">{ingredient}</span>
                </p>
              </div>
              <ul className="divide-y divide-gray-100">
                {list.map((sub) => {
                  const ratioLabel = formatRatio(sub.ratio);
                  return (
                    <li key={sub.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-orange-500 mt-0.5">→</span>
                        <span>
                          <span className="font-medium">{sub.toIngredient}</span>
                          {ratioLabel && (
                            <span className="text-gray-400 ml-1">({ratioLabel})</span>
                          )}
                          {sub.notes && (
                            <span className="text-gray-500 ml-1 italic">— {sub.notes}</span>
                          )}
                          {sub.isOfficial && (
                            <span className="ml-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                              verified
                            </span>
                          )}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate(sub.id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-400 hover:text-red-600 shrink-0"
                        aria-label="Delete substitution"
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
