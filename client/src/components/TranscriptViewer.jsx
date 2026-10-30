import { useEffect, useRef } from 'react';
import { formatTimestamp } from '../utils/format.js';

/** Read-only view of the stored transcript segments; highlights and scrolls to cited ids. */
export default function TranscriptViewer({ segments, highlight = [], focusId, className = '' }) {
  const refs = useRef({});
  const marked = new Set(highlight);

  useEffect(() => {
    if (focusId != null) refs.current[focusId]?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [focusId, segments]);

  if (!segments?.length) return <p className="p-4 text-sm text-muted">No transcript available.</p>;
  return (
    <ol className={`space-y-1 ${className}`} aria-label="Original transcript">
      {segments.map((s) => (
        <li
          key={s.segment_id}
          id={`seg-${s.segment_id}`}
          ref={(el) => { refs.current[s.segment_id] = el; }}
          className={`rounded-md px-3 py-2 text-sm leading-relaxed transition-colors ${marked.has(s.segment_id) ? 'bg-brand-soft ring-1 ring-brand/40' : ''} ${focusId === s.segment_id ? 'ring-2 ring-brand' : ''}`}
        >
          <div className="mb-0.5 flex items-center gap-2 text-xs text-muted">
            <span className="font-mono">#{s.segment_id}</span>
            {s.start_ms != null && <span className="font-mono">{formatTimestamp(s.start_ms)}</span>}
            {s.speaker && <span className="font-semibold text-ink">{s.speaker}</span>}
          </div>
          <p className="whitespace-pre-wrap break-words">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
