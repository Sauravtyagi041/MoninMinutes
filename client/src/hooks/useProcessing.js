import { useEffect, useRef, useState } from 'react';
import { meetings } from '../services/api.js';

const TERMINAL = new Set(['completed', 'failed']);

/**
 * Polls GET /meetings/:id/processing-status until the latest job finishes.
 * Progress shown to the user comes only from what the backend reports.
 */
export function useProcessing(meetingId, { enabled, interval = 1500, onFinished }) {
  const [status, setStatus] = useState(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  });

  useEffect(() => {
    if (!enabled || !meetingId) {
      setStatus(null);
      return undefined;
    }
    let cancelled = false;
    let timer;
    let failures = 0;

    const tick = async () => {
      try {
        const { data } = await meetings.status(meetingId);
        if (cancelled) return;
        failures = 0;
        setConnectionLost(false);
        setStatus(data);
        const jobDone = data.job && TERMINAL.has(data.job.status);
        if (jobDone || (!data.job && TERMINAL.has(data.meetingStatus))) {
          finished.current?.(data);
          return;
        }
      } catch {
        failures += 1;
        if (failures >= 2) setConnectionLost(true);
      }
      timer = setTimeout(tick, interval);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [meetingId, enabled, interval]);

  return { status, connectionLost };
}
