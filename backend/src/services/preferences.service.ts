import { prisma } from '../db.js';
import type { UpdatePreferencesInput } from '../schemas/preferences.schema.js';

/** The public shape of a user's preferences (no row id / userId). */
export interface PreferencesDto {
  unitSystem: string;
  locale: string;
  theme: string;
}

const select = { unitSystem: true, locale: true, theme: true } as const;

/**
 * Get the user's preferences, creating the row with schema defaults on first read. `userId` is
 * unique on UserPreferences (and non-nullable), so upsert is safe here — unlike the nullable
 * global+private tables.
 */
export async function getPreferences(userId: string): Promise<PreferencesDto> {
  return prisma.userPreferences.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select,
  });
}

/** Apply a partial update (creating the row first if it doesn't exist yet). */
export async function updatePreferences(
  userId: string,
  data: UpdatePreferencesInput,
): Promise<PreferencesDto> {
  return prisma.userPreferences.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select,
  });
}
