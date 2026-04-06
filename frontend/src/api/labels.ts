import { apiGet, apiPost } from './client';

export interface Label {
  id: string;
  type: string;
  name: string;
  autoDetectable: boolean;
}

export function fetchLabels(type?: string): Promise<Label[]> {
  return apiGet<Label[]>('/labels', type ? { type } : undefined);
}

export function createLabel(data: { type: string; name: string; autoDetectable?: boolean }): Promise<Label> {
  return apiPost<Label>('/labels', data);
}

export function assignLabels(recipeId: string, labelIds: string[]): Promise<unknown> {
  return apiPost(`/recipes/${recipeId}/labels`, { labelIds });
}

export function assignCourses(recipeId: string, courseTypes: string[]): Promise<unknown> {
  return apiPost(`/recipes/${recipeId}/courses`, { courseTypes });
}
