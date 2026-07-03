import { apiPost } from './client';
import type { CreateRecipeInput } from '../types/recipe';

export type ParsedRecipe = Omit<CreateRecipeInput, 'ingredients' | 'steps'> & {
  title: string;
  servings: number;
  totalTime: number | null;
  activeTime: number | null;
  source: string | null;
  authorNotes: string | null;
  ingredients: {
    name: string;
    originalName: string;
    amount: number | null;
    unit: string | null;
    isOptional: boolean;
    orderIndex: number;
  }[];
  steps: {
    orderIndex: number;
    instruction: string;
    timeMinutes: number | null;
    isActiveTime: boolean;
  }[];
};

export async function importFromUrl(url: string): Promise<ParsedRecipe> {
  return apiPost<ParsedRecipe>('/import/url', { url });
}

export async function importFromFile(file: File): Promise<ParsedRecipe> {
  const formData = new FormData();
  formData.append('file', file);

  // This is a raw fetch (multipart), so it needs credentials + the CSRF token explicitly.
  const csrfMatch = document.cookie.match(/(?:^|; )kc_csrf=([^;]*)/);
  const headers: Record<string, string> = {};
  if (csrfMatch) headers['x-csrf-token'] = decodeURIComponent(csrfMatch[1]);

  const response = await fetch('/api/import/file', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Import failed with status ${response.status}`);
  }

  return response.json();
}
