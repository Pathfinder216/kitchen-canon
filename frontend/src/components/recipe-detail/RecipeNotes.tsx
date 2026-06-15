interface RecipeNotesProps {
  authorNotes: string | null;
  personalNotes: string | null;
}

/** Author + personal notes sections, shown after ingredients and steps. */
export function RecipeNotes({ authorNotes, personalNotes }: RecipeNotesProps) {
  return (
    <>
      {authorNotes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-1">Author Notes</h3>
          <p className="text-sm text-yellow-700">{authorNotes}</p>
        </div>
      )}
      {personalNotes && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
          <h3 className="text-sm font-medium text-blue-800 mb-1">Personal Notes</h3>
          <p className="text-sm text-blue-700">{personalNotes}</p>
        </div>
      )}
    </>
  );
}
