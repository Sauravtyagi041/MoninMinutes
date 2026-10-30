import { AlertTriangle, Check, Circle, Loader2, WifiOff } from 'lucide-react';
import { Button } from './ui.jsx';

export const STAGE_LABELS = {
  validate: 'Validating transcript',
  speakers: 'Extracting speaker information',
  analyze: 'Analyzing discussion',
  extract: 'Identifying decisions and action items',
  prepare: 'Preparing structured minutes',
  save: 'Saving results',
};
const ORDER = Object.keys(STAGE_LABELS);

/**
 * Step-based progress. A step shows as complete only when the backend lists it in
 * `completedStages`; there are no made-up percentages.
 */
export default function ProcessingProgress({ status, connectionLost, starting, onRetry, retrying }) {
  const job = status?.job;
  const failed = job?.status === 'failed';
  const done = new Set(job?.completedStages || []);
  const queued = !job || job.status === 'queued';

  return (
    <div aria-live="polite" className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">
          {failed ? 'Processing didn’t finish' : starting ? 'Preparing your transcript…' : queued ? 'Waiting for a worker…' : 'Generating your minutes…'}
        </h2>
        {!failed && <p className="mt-1 text-sm text-muted">This usually takes under a minute. You can leave this page — processing continues on the server.</p>}
      </div>

      <ol className="space-y-3">
        {ORDER.map((key) => {
          const isDone = done.has(key);
          const isCurrent = !isDone && !failed && job?.status === 'running' && job.stage === key;
          const isFailedHere = failed && job.stage === key && !isDone;
          return (
            <li key={key} className="flex items-center gap-3 text-sm" aria-current={isCurrent ? 'step' : undefined}>
              {isDone ? <Check className="size-5 rounded-full bg-ok-soft p-1 text-ok" aria-label="Done" />
                : isCurrent ? <Loader2 className="size-5 animate-spin text-brand" aria-label="In progress" />
                : isFailedHere ? <AlertTriangle className="size-5 text-bad" aria-label="Failed" />
                : <Circle className="size-5 text-line" aria-label="Pending" />}
              <span className={isDone ? 'text-ink' : isCurrent ? 'font-medium text-ink' : 'text-muted'}>{STAGE_LABELS[key]}</span>
            </li>
          );
        })}
      </ol>

      {connectionLost && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          <WifiOff className="size-4" aria-hidden /> Connection lost — retrying. Processing continues on the server.
        </p>
      )}
      {failed && (
        <div role="alert" className="space-y-3 rounded-lg bg-bad-soft p-4 text-sm text-bad">
          <p>{job.errorMessage || 'Meeting analysis could not be completed. Your transcript is saved, so you can retry without uploading it again.'}</p>
          {onRetry && <Button variant="secondary" size="sm" loading={retrying} onClick={onRetry}>Retry</Button>}
        </div>
      )}
    </div>
  );
}
