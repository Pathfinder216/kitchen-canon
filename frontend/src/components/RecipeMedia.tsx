import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchRecipeCover,
  uploadRecipeCover,
  deleteRecipeMedia,
} from '../api/media';
import { useMediaVisibility } from '../hooks/useMediaVisibility';
import { useImageCrop } from '../hooks/useImageCrop';

interface RecipeMediaProps {
  recipeId: string;
  /** Read-only display mode (no upload/delete controls) */
  readOnly?: boolean;
}

export function RecipeMedia({ recipeId, readOnly = false }: RecipeMediaProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');
  const { showMedia } = useMediaVisibility();

  const { data: cover = null } = useQuery({
    queryKey: ['cover-photo', recipeId],
    queryFn: () => fetchRecipeCover(recipeId),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (cover) await deleteRecipeMedia(recipeId, cover.id);
      return uploadRecipeCover(recipeId, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cover-photo', recipeId] });
      setUploadError('');
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (err) => {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (mediaId: string) => deleteRecipeMedia(recipeId, mediaId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cover-photo', recipeId] }),
  });

  // Images go through the optional crop dialog first; the upload itself is unchanged.
  const crop = useImageCrop((file) => uploadMutation.mutate(file));

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so re-picking the same file after cancelling the crop still fires onChange.
    e.target.value = '';
    if (file) crop.pick(file);
  }

  // ── Read-only (detail page) — respects the media visibility toggle ──────
  if (readOnly) {
    if (!showMedia || !cover) return null;
    return (
      // Natural aspect ratio, capped in height — no forced ratio, so nothing is cropped or stretched.
      <div className="mb-6">
        <img
          src={cover.path}
          alt=""
          className="block max-h-80 w-auto max-w-full mx-auto rounded-xl border border-gray-200"
        />
      </div>
    );
  }

  // ── Edit mode — compact horizontal row ───────────────────────────────────
  return (
    <div className="flex items-center gap-3">
      {cover ? (
        <>
          <div className="relative group w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-gray-200">
            <img src={cover.path} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer text-xs text-gray-600 hover:text-gray-900 border border-gray-300 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">
              {uploadMutation.isPending ? 'Uploading…' : 'Change'}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
                disabled={uploadMutation.isPending}
              />
            </label>
            <button
              onClick={() => deleteMutation.mutate(cover.id)}
              disabled={deleteMutation.isPending}
              className="text-xs text-red-500 hover:text-red-700 border border-gray-300 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
            >
              Remove
            </button>
          </div>
        </>
      ) : (
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 hover:border-gray-300 rounded-lg px-3 py-2 transition-colors">
          <span className="text-lg leading-none">🖼</span>
          <span>{uploadMutation.isPending ? 'Uploading…' : '+ Add cover photo'}</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileChange}
            disabled={uploadMutation.isPending}
          />
        </label>
      )}
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
      {crop.dialog}
    </div>
  );
}
