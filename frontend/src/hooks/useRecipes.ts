import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as recipesApi from '../api/recipes';
import type { RecipeListParams, CreateRecipeInput, UpdateRecipeInput } from '../types/recipe';

export function useRecipes(params?: RecipeListParams) {
  return useQuery({
    queryKey: ['recipes', params],
    queryFn: () => recipesApi.fetchRecipes(params),
  });
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: () => recipesApi.fetchRecipe(id!),
    enabled: !!id,
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRecipeInput) => recipesApi.createRecipe(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRecipeInput }) =>
      recipesApi.updateRecipe(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipe'] });
    },
  });
}

export function useArchiveRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => recipesApi.archiveRecipe(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipe', id] });
    },
  });
}

export function useDeleteRecipePermanently() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (id: string) => recipesApi.deleteRecipePermanently(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      navigate('/');
    },
  });
}

export function useRecipeVersions(id: string | undefined) {
  return useQuery({
    queryKey: ['recipeVersions', id],
    queryFn: () => recipesApi.fetchRecipeVersions(id!),
    enabled: !!id,
  });
}

export function useRestoreRecipeVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      recipesApi.restoreRecipeVersion(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipe'] });
      queryClient.invalidateQueries({ queryKey: ['recipeVersions'] });
    },
  });
}
