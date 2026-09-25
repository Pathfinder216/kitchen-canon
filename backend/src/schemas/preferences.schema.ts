import { z } from 'zod';
import { UNIT_SYSTEM_PREFERENCES } from '../constants/units.js';

/** Themes the UI understands. Stored as a free string column; validated here. */
export const THEMES = ['light', 'dark'] as const;

/**
 * PATCH /api/preferences — every field optional (partial update). Unknown keys are rejected so a
 * typo'd field name fails loudly instead of silently doing nothing.
 */
export const updatePreferencesSchema = z
  .object({
    unitSystem: z.enum(UNIT_SYSTEM_PREFERENCES),
    // BCP 47 tag, e.g. "en-US" (groundwork for plan 22). Loose shape check only.
    locale: z.string().trim().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, 'Invalid locale tag').max(35),
    theme: z.enum(THEMES),
  })
  .partial()
  .strict();

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
