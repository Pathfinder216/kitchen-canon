import { apiGet } from './client';

export interface Course {
  type: string;
  name: string;
}

export const COURSE_DISPLAY_NAMES: Record<string, string> = {
  APPETIZER: 'Appetizer',
  SOUP:      'Soup',
  SALAD:     'Salad',
  BREAD:     'Bread',
  MAIN:      'Main Course',
  SIDE:      'Side Dish',
  DESSERT:   'Dessert',
  BREAKFAST: 'Breakfast',
  SNACK:     'Snack',
  DRINK:     'Drink',
  TOPPING:   'Topping / Condiment',
};

export function fetchCourses(): Promise<Course[]> {
  return apiGet<Course[]>('/courses');
}
