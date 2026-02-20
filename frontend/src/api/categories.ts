import { apiGet, apiPost } from './client';

export interface Category {
  id: string;
  name: string;
}

export function fetchCategories(): Promise<Category[]> {
  return apiGet<Category[]>('/categories');
}

export function createCategory(name: string): Promise<Category> {
  return apiPost<Category>('/categories', { name });
}
