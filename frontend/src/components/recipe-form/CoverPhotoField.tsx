import { RecipeMedia } from '../RecipeMedia';
import { labelClass } from './styles';

interface CoverPhotoFieldProps {
  /** Set when editing an existing recipe — shows live RecipeMedia upload UI. */
  recipeId?: string;
  coverPhotoPreview: string | null;
  onChange: (file: File) => void;
  onRemove: () => void;
}

export function CoverPhotoField({ recipeId, coverPhotoPreview, onChange, onRemove }: CoverPhotoFieldProps) {
  return (
    <div>
      <h3 className={labelClass}>Cover Photo</h3>
      {recipeId ? (
        <RecipeMedia recipeId={recipeId} />
      ) : coverPhotoPreview ? (
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-gray-200">
            <img src={coverPhotoPreview} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer text-xs text-gray-600 hover:text-gray-900 border border-gray-300 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">
              Change
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = ''; }} />
            </label>
            <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:text-red-700 border border-gray-300 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 hover:border-gray-300 rounded-lg px-3 py-2 transition-colors">
          <span className="text-lg leading-none">🖼</span>
          <span>+ Add cover photo</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = ''; }} />
        </label>
      )}
    </div>
  );
}
