import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';

interface MediaItem {
  id: string;
  type: string;
  path: string;
  orderIndex: number | null;
}

async function fetchMedia(recipeId: string): Promise<MediaItem[]> {
  const res = await fetch(`/api/recipes/${recipeId}/media`);
  if (!res.ok) throw new ApiError(res.status, 'Failed to load media');
  return res.json();
}

async function uploadMedia(recipeId: string, file: File): Promise<MediaItem> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/recipes/${recipeId}/media`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || 'Upload failed');
  }
  return res.json();
}

async function deleteMedia(recipeId: string, mediaId: string): Promise<void> {
  const res = await fetch(`/api/recipes/${recipeId}/media/${mediaId}`, { method: 'DELETE' });
  if (!res.ok) throw new ApiError(res.status, 'Delete failed');
}

interface RecipeMediaProps {
  recipeId: string;
}

export function RecipeMedia({ recipeId }: RecipeMediaProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');

  const { data: media = [] } = useQuery({
    queryKey: ['media', recipeId],
    queryFn: () => fetchMedia(recipeId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadMedia(recipeId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', recipeId] });
      setUploadError('');
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (err) => {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (mediaId: string) => deleteMedia(recipeId, mediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', recipeId] });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  }

  const images = media.filter((m) => m.type === 'image');

  return (
    <div className="mt-4">
      {/* Gallery */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {images.map((m) => (
            <div key={m.id} className="relative group w-32 h-32">
              <img
                src={m.path}
                alt=""
                className="w-full h-full object-cover rounded-lg border border-gray-200"
              />
              <button
                onClick={() => deleteMutation.mutate(m.id)}
                className="absolute top-1 right-1 bg-black/60 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Delete image"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload */}
      <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-600 hover:text-gray-800">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
          disabled={uploadMutation.isPending}
        />
        <span className="border border-gray-300 px-3 py-1 rounded-lg hover:bg-gray-50 transition-colors">
          {uploadMutation.isPending ? 'Uploading...' : images.length > 0 ? '+ Add photo' : '+ Add photo'}
        </span>
      </label>

      {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
    </div>
  );
}
