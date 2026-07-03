import { apiGet, apiPost } from './client';

export interface AuthUser {
  id: string;
  email: string;
}

export function getCurrentUser(): Promise<AuthUser> {
  return apiGet<AuthUser>('/auth/me');
}

export function loginRequest(email: string, password: string): Promise<AuthUser> {
  return apiPost<AuthUser>('/auth/login', { email, password });
}

export function registerRequest(
  email: string,
  password: string,
  inviteCode?: string,
): Promise<AuthUser> {
  return apiPost<AuthUser>('/auth/register', {
    email,
    password,
    ...(inviteCode ? { inviteCode } : {}),
  });
}

export function logoutRequest(): Promise<void> {
  return apiPost<void>('/auth/logout');
}

/** Fetch a fresh CSRF token (also sets the kc_csrf cookie the client reads). */
export function fetchCsrfToken(): Promise<{ csrfToken: string }> {
  return apiGet<{ csrfToken: string }>('/auth/csrf');
}
