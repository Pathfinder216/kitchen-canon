import type { CookingTimeline } from '../../types/meal-plan';
import { formatDuration } from '../../utils/formatDuration';
import { blockBackground, formatClock, minutesBetween, tickInterval, ticks } from '../../utils/timeline';

interface Props {
  timeline: CookingTimeline;
  colorFor: (itemId: string) => string;
  /** Wall-clock time for the "now" line; null hides it (e.g. serve time isn't today). */
  now: Date | null;
  /** Step ids in progress (live mode); highlighted. */
  currentStepIds: Set<string>;
}

const MIN_HEIGHT = 260;
const MAX_HEIGHT = 1400;
/** Blocks shorter than this (px) show no inline label; the tooltip still has it. */
const LABEL_MIN_PX = 18;

/**
 * Proportional vertical timeline: a clock gutter on the left and one lane per recipe. Active
 * steps are solid, passive steps hatched, so passive windows that other recipes' prep slots into
 * are easy to see.
 */
export function TimelineChart({ timeline, colorFor, now, currentStepIds }: Props) {
  const lanes = timeline.recipes.filter((r) => r.start !== null);
  if (lanes.length === 0) return null;

  const startMs = Date.parse(timeline.start);
  const endMs = Date.parse(timeline.serveAt);
  const span = Math.max(minutesBetween(timeline.start, timeline.serveAt), 30);
  const height = Math.min(Math.max(span * 3, MIN_HEIGHT), MAX_HEIGHT);
  const pxPerMin = height / span;
  const top = (ms: number) => ((ms - startMs) / 60_000) * pxPerMin;
  const serveDate = new Date(endMs);

  const nowMs = now?.getTime();
  const showNow = nowMs !== undefined && nowMs >= startMs && nowMs <= endMs;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto">
      {/* Lane headers */}
      <div className="flex gap-1 pl-16 mb-2">
        {lanes.map((r) => (
          <div key={r.itemId} className="flex-1 min-w-24 flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: colorFor(r.itemId) }} />
            <span className="truncate" title={r.title}>{r.title}</span>
          </div>
        ))}
      </div>

      <div className="relative flex" style={{ height }} data-testid="timeline-chart">
        {/* Gutter */}
        <div className="relative w-16 shrink-0 text-[11px] text-gray-500">
          {ticks(startMs, endMs, tickInterval(span)).map((t) => (
            <div key={t} className="absolute right-2 -translate-y-1/2" style={{ top: top(t) }}>
              {formatClock(new Date(t), serveDate)}
            </div>
          ))}
        </div>

        {/* Lanes */}
        <div className="relative flex-1 flex gap-1">
          {ticks(startMs, endMs, tickInterval(span)).map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-gray-100" style={{ top: top(t) }} />
          ))}

          {lanes.map((r) => {
            const color = colorFor(r.itemId);
            return (
              <div key={r.itemId} className="relative flex-1 min-w-24">
                {timeline.entries
                  .filter((e) => e.itemId === r.itemId)
                  .map((e) => {
                    const h = Math.max(minutesBetween(e.start, e.end) * pxPerMin, 2);
                    const current = currentStepIds.has(e.stepId);
                    const tooltip = `${e.label} — ${formatClock(e.start, serveDate)}–${formatClock(e.end, serveDate)}` +
                      `${e.isActive ? ' (active)' : ' (passive)'}${e.untimed ? ', untimed' : ''}`;
                    return (
                      <div
                        key={e.stepId}
                        title={tooltip}
                        className={`absolute inset-x-0 rounded-sm overflow-hidden px-1 text-[11px] leading-tight border ${
                          current ? 'ring-2 ring-offset-1 ring-gray-900 z-10' : ''
                        } ${e.isActive ? 'text-white' : 'text-gray-800'}`}
                        style={{
                          top: top(Date.parse(e.start)),
                          height: h,
                          background: blockBackground(color, e.isActive),
                          borderColor: color,
                        }}
                      >
                        {h >= LABEL_MIN_PX && (
                          <span className="block truncate pt-0.5">
                            {e.label}
                            {h >= LABEL_MIN_PX * 2 && (
                              <span className="block opacity-80">{formatDuration(minutesBetween(e.start, e.end))}</span>
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}

          {showNow && (
            <div
              className="absolute inset-x-0 border-t-2 border-red-500 z-20 pointer-events-none"
              style={{ top: top(nowMs) }}
              data-testid="now-line"
            >
              <span className="absolute -top-2.5 right-0 bg-red-500 text-white text-[10px] font-semibold px-1 rounded">
                Now
              </span>
            </div>
          )}
        </div>
      </div>
      <p className="pl-16 mt-1 text-xs font-medium text-gray-700">Serve {formatClock(timeline.serveAt)}</p>
    </div>
  );
}
