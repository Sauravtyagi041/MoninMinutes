import { Badge } from './ui.jsx';
import { MEETING_STATUS_LABEL, PRIORITY_LABEL, STATUS_LABEL } from '../utils/format.js';

const MEETING_TONE = { draft: 'neutral', queued: 'warn', processing: 'brand', completed: 'ok', failed: 'bad' };
const STATUS_TONE = { pending: 'neutral', in_progress: 'brand', completed: 'ok' };
const PRIORITY_TONE = { low: 'neutral', medium: 'warn', high: 'bad' };

export const MeetingStatusBadge = ({ status }) => (
  <Badge tone={MEETING_TONE[status] || 'neutral'}>{MEETING_STATUS_LABEL[status] || status}</Badge>
);
export const ActionStatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
export const PriorityBadge = ({ priority }) => <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
