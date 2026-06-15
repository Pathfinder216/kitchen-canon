import { forwardRef } from 'react';

const base = 'rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

interface PlanDetailsFieldsProps {
  name: string;
  onNameChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  time: string;
  onTimeChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}

/** Plan metadata fields: name / date / time / notes. The date input forwards a ref so the
 *  page can focus it on remake. */
export const PlanDetailsFields = forwardRef<HTMLInputElement, PlanDetailsFieldsProps>(
  function PlanDetailsFields(
    { name, onNameChange, date, onDateChange, time, onTimeChange, notes, onNotesChange },
    dateRef,
  ) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="col-span-2">
          <label htmlFor="plan-name" className={labelClass}>Name *</label>
          <input
            id="plan-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Sunday dinner"
            className={base + ' w-full'}
            required
          />
        </div>
        <div>
          <label htmlFor="plan-date" className={labelClass}>Date</label>
          <input
            ref={dateRef}
            id="plan-date"
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className={base + ' w-full'}
          />
        </div>
        <div>
          <label htmlFor="plan-time" className={labelClass}>Time</label>
          <input
            id="plan-time"
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            className={base + ' w-full'}
          />
        </div>
        <div className="col-span-2 md:col-span-4">
          <label htmlFor="plan-notes" className={labelClass}>Notes</label>
          <textarea
            id="plan-notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Occasion, guests, special requirements…"
            rows={2}
            className={base + ' w-full resize-none'}
          />
        </div>
      </div>
    );
  },
);
