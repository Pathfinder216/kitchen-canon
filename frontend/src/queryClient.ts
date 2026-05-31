import { QueryClient } from '@tanstack/react-query';

// Shared QueryClient instance so both App and the auth provider can clear the cache
// (e.g. on login/logout) to prevent one user's data leaking into another's session.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});
