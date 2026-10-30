const lower = (s) => s.toLowerCase();
const day = (d) => (d ? d.toISOString().slice(0, 10) : null);

export const serializeAction = (a) => ({
  id: a.id,
  meetingId: a.meetingId,
  meetingTitle: a.meeting?.title,
  task: a.task,
  assignee: a.assignee,
  dueDate: day(a.dueDate),
  originalDueDateText: a.originalDueDateText,
  priority: lower(a.priority),
  status: lower(a.status),
  evidence: a.evidence,
  sourceSegmentIds: a.sourceSegmentIds,
  confidence: a.confidence,
  origin: lower(a.origin),
  userEdited: a.userEdited,
  overdue: isOverdue(a),
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
});

// Overdue only when a real due date has passed and the task isn't completed.
export const isOverdue = (a, today = new Date().toISOString().slice(0, 10)) =>
  Boolean(a.dueDate) && a.status !== 'COMPLETED' && day(a.dueDate) < today;

export const serializeMeeting = (m) => ({
  id: m.id,
  title: m.title,
  description: m.description,
  participants: m.participants,
  meetingDate: day(m.meetingDate),
  timezone: m.timezone,
  processingStatus: lower(m.processingStatus),
  transcriptFormat: m.transcriptFormat,
  hasTranscript: m.transcriptFormat != null,
  actionItemCount: m._count?.actionItems,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
});

export const serializeMinutes = (m) =>
  m && {
    overview: m.overview,
    key_points: m.keyPoints,
    decisions: m.decisions,
    risks: m.risks,
    open_questions: m.openQuestions,
    modelName: m.modelName,
    generatedAt: m.generatedAt,
    updatedAt: m.updatedAt,
  };

export const serializeJob = (j) =>
  j && {
    id: j.id,
    status: lower(j.status),
    stage: j.stage,
    completedStages: j.completedStages,
    errorCode: j.errorCode,
    errorMessage: j.errorMessage,
    attempts: j.attempts,
    createdAt: j.createdAt,
    startedAt: j.startedAt,
    completedAt: j.completedAt,
  };

export const serializeSegment = (s) => ({
  segment_id: s.segmentIndex,
  speaker: s.speaker,
  start_ms: s.startMs,
  end_ms: s.endMs,
  text: s.text,
});

export const toEnum = (s) => (s == null ? s : s.toUpperCase());
export const dateOnly = (s) => (s ? new Date(`${s}T00:00:00.000Z`) : null);
