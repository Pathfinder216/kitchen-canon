import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './layouts/AppLayout';
import { RecipeListPage } from './pages/RecipeListPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { RecipeFormPage } from './pages/RecipeFormPage';
import { MealHistoryPage } from './pages/MealHistoryPage';
import { MealPlanDetailPage } from './pages/MealPlanDetailPage';
import { MealPlanFormPage } from './pages/MealPlanFormPage';
import { CookModePage } from './pages/CookModePage';
import { ImportPage } from './pages/ImportPage';
import { RecipeVersionHistoryPage } from './pages/RecipeVersionHistoryPage';
import { SubstitutionsPage } from './pages/SubstitutionsPage';
import { IngredientsPage } from './pages/IngredientsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RecipeListPage />} />
          <Route path="/recipes/new" element={<RecipeFormPage />} />
          <Route path="/recipes/:id" element={<RecipeDetailPage />} />
          <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
          <Route path="/recipes/:id/cook" element={<CookModePage />} />
          <Route path="/recipes/:id/versions" element={<RecipeVersionHistoryPage />} />
          <Route path="/meal-plans" element={<MealHistoryPage />} />
          <Route path="/meal-plans/new" element={<MealPlanFormPage />} />
          <Route path="/meal-plans/:id/edit" element={<MealPlanFormPage />} />
          <Route path="/meal-plans/:id" element={<MealPlanDetailPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/substitutions" element={<SubstitutionsPage />} />
          <Route path="/ingredients" element={<IngredientsPage />} />
        </Route>
      </Routes>
    </QueryClientProvider>
  );
}
