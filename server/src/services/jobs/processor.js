import { prisma } from '../../config/db.js';
import { logger } from '../../utils/logger.js';
import { AiError } from '../ai/errors.js';
import { analyzeMeeting } from '../ai/analyze.js';
import { createProvider } from '../ai/providers.js';
import { similarity } from '../ai/merge.js';
import { speakersOf } from '../transcript/parser.js';

export const STAGES = ['validate', 'speakers', 'analyze', 'extract', 'prepare', 'save'];

const PRIORITY = { low: 'LOW', medium: 'MEDIUM', high: 'HIGH' };

const toSegment = (s) => ({
  segment_id: s.segmentIndex,
  speaker: s.speaker,
  start_ms: s.startMs,
  end_ms: s.endMs,
  text: s.text,
});

class JobAbort extends Error {}

/** Records a stage as started; completion is recorded separately once it has really finished. */
const stageTracker = (jobId) => ({
  begin: (stage) =>
    prisma.processingJob.updateMany({ where: { id: jobId }, data: { stage, heartbeatAt: new Date() } }),
  done: async (stage) => {
    const row = await prisma.processingJob.findUnique({ where: { id: jobId }, select: { completedStages: true } });
    if (!row) throw new JobAbort('job removed');
    if (row.completedStages.includes(stage)) return;
    await prisma.processingJob.update({
      where: { id: jobId },
      data: { completedStages: { push: stage }, heartbeatAt: new Date() },
    });
  },
});

async function persist({ job, meeting, result }) {
  return prisma.$transaction(async (tx) => {
    const still = await tx.meeting.findUnique({ where: { id: meeting.id }, select: { id: true } });
    if (!still) throw new JobAbort('meeting deleted');

    const { minutes } = result;
    const data = {
      overview: minutes.overview,
      keyPoints: minutes.key_points,
      decisions: minutes.decisions,
      risks: minutes.risks,
      openQuestions: minutes.open_questions,
      modelName: result.model,
      generatedAt: new Date(),
    };
    await tx.meetingMinutes.upsert({
      where: { meetingId: meeting.id },
      create: { meetingId: meeting.id, ...data },
      update: data,
    });

    // Regeneration replaces AI items the user hasn't touched; manual and edited items survive.
    await tx.actionItem.deleteMany({ where: { meetingId: meeting.id, origin: 'AI', userEdited: false } });
    const kept = await tx.actionItem.findMany({ where: { meetingId: meeting.id }, select: { task: true } });
    const fresh = result.action_items.filter(
      (a) => !kept.some((k) => similarity(k.task, a.task) >= 0.6),
    );
    if (fresh.length) {
      await tx.actionItem.createMany({
        data: fresh.map((a) => ({
          meetingId: meeting.id,
          task: a.task,
          assignee: a.assignee,
          dueDate: a.due_date ? new Date(`${a.due_date}T00:00:00.000Z`) : null,
          originalDueDateText: a.due_date_text,
          priority: PRIORITY[a.priority],
          status: 'PENDING',
          evidence: a.evidence,
          sourceSegmentIds: a.segment_ids,
          confidence: a.confidence,
          origin: 'AI',
        })),
      });
    }
    await tx.meeting.update({ where: { id: meeting.id }, data: { processingStatus: 'COMPLETED' } });
    await tx.processingJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        errorMessage: null,
        errorCode: null,
        promptTokens: result.usage.prompt,
        completionTokens: result.usage.completion,
        completedStages: { push: 'save' },
      },
    });
  });
}

/** Runs one claimed job to completion or failure. Never throws. */
export async function processJob(job, { providerFactory = createProvider } = {}) {
  const track = stageTracker(job.id);
  try {
    await track.begin('validate');
    const meeting = await prisma.meeting.findUnique({
      where: { id: job.meetingId },
      include: { segments: { orderBy: { segmentIndex: 'asc' } }, minutes: { select: { id: true } } },
    });
    if (!meeting) throw new JobAbort('meeting deleted');
    if (!meeting.segments.length) {
      throw new AiError('NO_TRANSCRIPT', 'This meeting has no transcript yet. Add one and try again.');
    }
    const provider = providerFactory(); // throws AI_CONFIG when credentials are missing
    await track.done('validate');

    await track.begin('speakers');
    const segments = meeting.segments.map(toSegment);
    const speakers = speakersOf(segments);
    logger.info('job speakers', { jobId: job.id, speakers: speakers.length, segments: segments.length });
    await track.done('speakers');

    await track.begin('analyze');
    const next = { analyze: 'extract', extract: 'prepare', prepare: 'save' };
    const result = await analyzeMeeting({
      meeting,
      segments,
      provider,
      onStage: async (stage) => {
        await track.done(stage);
        if (next[stage]) await track.begin(next[stage]);
      },
    });

    await persist({ job, meeting, result });
    logger.info('job completed', { jobId: job.id, chunks: result.chunkCount, tokens: result.usage });
  } catch (e) {
    await failJob(job, e);
  }
}

async function failJob(job, e) {
  if (e instanceof JobAbort) {
    logger.info('job aborted', { jobId: job.id, reason: e.message });
    await prisma.processingJob.updateMany({
      where: { id: job.id },
      data: { status: 'FAILED', errorCode: 'ABORTED', errorMessage: 'The meeting was removed during processing.', completedAt: new Date() },
    });
    return;
  }
  const known = e instanceof AiError;
  const code = known ? e.code : 'INTERNAL';
  const message = known
    ? e.userMessage
    : 'Meeting analysis could not be completed. Your transcript is saved, so you can retry without uploading it again.';
  // Log the error class only, never provider payloads or transcript content.
  logger.error('job failed', { jobId: job.id, code, name: e?.name });
  await prisma.processingJob.updateMany({
    where: { id: job.id },
    data: { status: 'FAILED', errorCode: code, errorMessage: message, completedAt: new Date() },
  });
  // Keep previously generated minutes visible if there are any.
  const hasMinutes = await prisma.meetingMinutes.findUnique({ where: { meetingId: job.meetingId }, select: { id: true } });
  await prisma.meeting.updateMany({
    where: { id: job.meetingId },
    data: { processingStatus: hasMinutes ? 'COMPLETED' : 'FAILED' },
  });
}
