import { localDateParts } from '../ai/dates.js';

export const fmtMeetingDate = (date) => {
  const { y, m, d } = localDateParts(date);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric',
  });
};

export const fmtDue = (dueDate, originalText) => {
  if (dueDate) {
    return new Date(dueDate).toLocaleDateString('en-US', {
      timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric',
    });
  }
  return originalText ? `${originalText} (date unresolved)` : 'No deadline specified';
};

export const STATUS_LABEL = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' };
export const PRIORITY_LABEL = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

export const refs = (ids) => (ids?.length ? ` _(transcript ${ids.map((i) => `#${i}`).join(', ')})_` : '');

export const safeFilename = (title) =>
  (title || 'meeting-minutes')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'meeting-minutes';
