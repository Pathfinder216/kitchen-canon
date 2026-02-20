import type { Step } from '../types/recipe';

interface StepListProps {
  steps: Step[];
}

export function StepList({ steps }: StepListProps) {
  if (steps.length === 0) {
    return <p className="text-gray-500 text-sm">No steps listed.</p>;
  }

  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={step.id} className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-sm font-semibold">
            {index + 1}
          </span>
          <div className="flex-1 pt-0.5">
            <p className="text-gray-900 text-sm">{step.instruction}</p>
            {step.timeMinutes && (
              <p className="text-xs text-gray-500 mt-1">
                {step.timeMinutes} min ({step.isActiveTime ? 'active' : 'inactive'})
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
