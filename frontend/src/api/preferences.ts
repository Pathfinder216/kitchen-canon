import { apiGet, apiPatch } from './client';

/** Display-time unit conversion preference: `original` = show units exactly as authored. */
export type UnitSystemPreference = 'original' | 'imperial' | 'metric';

export const UNIT_SYSTEM_PREFERENCES: readonly UnitSystemPreference[] = ['original', 'imperial', 'metric'];

export interface Preferences {
  unitSystem: UnitSystemPreference;
  locale: string;
  theme: string;
}

export type PreferencesUpdate = Partial<Preferences>;

export function fetchPreferences(): Promise<Preferences> {
  return apiGet<Preferences>('/preferences');
}

export function updatePreferences(data: PreferencesUpdate): Promise<Preferences> {
  return apiPatch<Preferences>('/preferences', data);
}
