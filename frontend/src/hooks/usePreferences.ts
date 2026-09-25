import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPreferences,
  updatePreferences,
  UNIT_SYSTEM_PREFERENCES,
  type Preferences,
  type PreferencesUpdate,
  type UnitSystemPreference,
} from '../api/preferences';

export const PREFERENCES_QUERY_KEY = ['preferences'] as const;

/** The signed-in user's preferences (GET /api/preferences — the row is created on first read). */
export function usePreferences() {
  return useQuery({
    queryKey: PREFERENCES_QUERY_KEY,
    // `?? null`: React Query rejects `undefined` data; a missing body just means "use defaults".
    queryFn: async () => (await fetchPreferences()) ?? null,
    staleTime: Infinity,
  });
}

/** Partial update; writes the server's response straight into the cache. */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PreferencesUpdate) => updatePreferences(data),
    onSuccess: (prefs: Preferences) => {
      queryClient.setQueryData(PREFERENCES_QUERY_KEY, prefs);
    },
  });
}

/**
 * The unit system to display quantities/temperatures in. Falls back to `original` (no conversion)
 * while loading, on error, or for any value this build doesn't recognise — so a missing preference
 * can never change what the user sees.
 */
export function useUnitSystem(): UnitSystemPreference {
  const { data } = usePreferences();
  const value = data?.unitSystem;
  return value && UNIT_SYSTEM_PREFERENCES.includes(value) ? value : 'original';
}
