import { usePreferences, useUpdatePreferences } from '../hooks/usePreferences';
import type { UnitSystemPreference } from '../api/preferences';

const UNIT_OPTIONS: { value: UnitSystemPreference; label: string; description: string }[] = [
  {
    value: 'original',
    label: 'As written',
    description: 'Show every recipe exactly as it was authored — no conversion.',
  },
  {
    value: 'metric',
    label: 'Metric',
    description: 'Show quantities in ml, l, g and kg, and oven temperatures in °C.',
  },
  {
    value: 'imperial',
    label: 'US / imperial',
    description: 'Show quantities in tsp, tbsp, cups, oz and lb, and oven temperatures in °F.',
  },
];

/** Per-user settings. Currently just the unit-system display preference (plan 27). */
export function SettingsPage() {
  const { data: prefs, isLoading, isError } = usePreferences();
  const update = useUpdatePreferences();
  // Show the pending choice immediately while the PATCH is in flight.
  const selected = update.isPending ? update.variables?.unitSystem : prefs?.unitSystem;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <fieldset disabled={isLoading || isError}>
          <legend className="text-base font-semibold text-gray-900">Units</legend>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Converts ingredient quantities, grocery lists and temperatures in steps for display.
            Your recipes are never changed.
          </p>
          <div className="space-y-2">
            {UNIT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selected === opt.value ? 'border-orange-300 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="unitSystem"
                  value={opt.value}
                  checked={selected === opt.value}
                  onChange={() => update.mutate({ unitSystem: opt.value })}
                  className="mt-1 h-4 w-4 text-orange-600 focus:ring-orange-500"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{opt.label}</span>
                  <span className="block text-xs text-gray-500">{opt.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {isError && <p className="text-xs text-red-600 mt-3">Couldn't load your settings.</p>}
        {update.isError && <p className="text-xs text-red-600 mt-3">Failed to save. Please try again.</p>}
      </section>
    </div>
  );
}
