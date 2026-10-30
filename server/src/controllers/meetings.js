import { Prisma } from '@prisma/client';
import multer from 'multer';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, badRequest, conflict, tooMany } from '../utils/errors.js';
import { ok, pageMeta, pageParams } from '../utils/http.js';
import {
  serializeAction, serializeJob, serializeMeeting, serializeMinutes, serializeSegment,
} from '../utils/serialize.js';
import { getOwnedMeeting } from '../services/access.js';
import { decodeUpload, prepareTranscript } from '../services/transcriptInput.js';
import { createProvider } from '../services/ai/providers.js';
import { AiError } from '../services/ai/errors.js';
import { STAGES } from '../services/jobs/processor.js';
import { buildMarkdown } from '../services/export/markdown.js';
import { buildPdf } from '../services/export/pdf.js';
import { safeFilename } from '../services/export/shared.js';

export const upload = multer({
  storage: multer.memoryStorage(), // nothing is written to disk
  limits: { fileSize: env.MAX_FILE_BYTES, files: 1 },
}).single('file');

const ACTIVE = ['QUEUED', 'RUNNING'];

export const list = asyncHandler(async (req, res) => {
  const { q, status, sort, order } = req.query;
  const paging = pageParams(req.query);
  const where = {
    createdById: req.user.id,
    ...(status && { processingStatus: status }),
    ...(q && { title: { contains: q, mode: 'insensitive' } }),
  };
  const [total, rows] = await Promise.all([
    prisma.meeting.count({ where }),
    prisma.meeting.findMany({
      where,
      orderBy: [{ [sort]: order }, { id: 'asc' }],
      skip: paging.skip,
      take: paging.take,
      include: { _count: { select: { actionItems: true } } },
    }),
  ]);
  ok(res, rows.map(serializeMeeting), pageMeta(paging, total));
});

export const create = asyncHandler(async (req, res) => {
  const meeting = await prisma.meeting.create({
    data: { ...req.body, participants: req.body.participants ?? [], createdById: req.user.id },
    include: { _count: { select: { actionItems: true } } },
  });
  ok(res, serializeMeeting(meeting), undefined, 201);
});

export const get = asyncHandler(async (req, res) => {
  const meeting = await getOwnedMeeting(req.params.id, req.user.id, {
    include: {
      minutes: true,
      actionItems: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      jobs: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { segments: true, actionItems: true } },
    },
  });
  ok(res, {
    ...serializeMeeting(meeting),
    segmentCount: meeting._count.segments,
    minutes: serializeMinutes(meeting.minutes),
    actionItems: meeting.actionItems.map(serializeAction),
    latestJob: serializeJob(meeting.jobs[0]),
  });
});

export const update = asyncHandler(async (req, res) => {
  await getOwnedMeeting(req.params.id, req.user.id, { select: { id: true } });
  const meeting = await prisma.meeting.update({
    where: { id: req.params.id },
    data: req.body,
    include: { _count: { select: { actionItems: true } } },
  });
  ok(res, serializeMeeting(meeting));
});

export const remove = asyncHandler(async (req, res) => {
  await getOwnedMeeting(req.params.id, req.user.id, { select: { id: true } });
  await prisma.meeting.delete({ where: { id: req.params.id } }); // cascades to everything else
  ok(res, { deleted: true });
});

// ---- Transcript ----

export const putTranscript = asyncHandler(async (req, res) => {
  const meeting = await getOwnedMeeting(req.params.id, req.user.id, { select: { id: true } });
  const busy = await prisma.processingJob.findFirst({
    where: { meetingId: meeting.id, status: { in: ACTIVE } }, select: { id: true },
  });
  if (busy) throw conflict('This meeting is being processed. Wait for it to finish before changing the transcript.');

  let input;
  if (req.file) {
    input = decodeUpload(req.file);
    input.format = undefined;
  } else {
    if (typeof req.body?.text !== 'string') throw badRequest('Provide transcript text or upload a file.');
    input = { text: req.body.text, format: req.body.format, filename: req.body.filename };
  }
  const { text, format, segments } = prepareTranscript(input);

  await prisma.$transaction([
    prisma.transcriptSegment.deleteMany({ where: { meetingId: meeting.id } }),
    prisma.transcriptSegment.createMany({
      data: segments.map((s) => ({
        meetingId: meeting.id,
        segmentIndex: s.segment_id,
        speaker: s.speaker,
        text: s.text,
        startMs: s.start_ms,
        endMs: s.end_ms,
      })),
    }),
    prisma.meeting.update({
      where: { id: meeting.id },
      data: { originalTranscript: text, transcriptFormat: format },
    }),
  ]);
  const speakers = [...new Set(segments.map((s) => s.speaker).filter(Boolean))];
  ok(res, { format, segmentCount: segments.length, speakers, characters: text.length }, undefined, 201);
});

export const getTranscript = asyncHandler(async (req, res) => {
  const meeting = await getOwnedMeeting(req.params.id, req.user.id, {
    select: { id: true, originalTranscript: true, transcriptFormat: true },
  });
  const segments = await prisma.transcriptSegment.findMany({
    where: { meetingId: meeting.id }, orderBy: { segmentIndex: 'asc' },
  });
  ok(res, {
    format: meeting.transcriptFormat,
    original: meeting.originalTranscript,
    segments: segments.map(serializeSegment),
  });
});

// ---- Generation ----

export const generate = asyncHandler(async (req, res) => {
  const meeting = await getOwnedMeeting(req.params.id, req.user.id, {
    select: { id: true, transcriptFormat: true, _count: { select: { segments: true } } },
  });
  if (!meeting._count.segments) throw badRequest('Add a transcript before generating minutes.');

  try {
    createProvider(); // fails fast on missing configuration; makes no network call
  } catch (e) {
    if (e instanceof AiError) throw new AppError(503, e.code, e.userMessage);
    throw e;
  }

  const existing = await prisma.processingJob.findFirst({
    where: { meetingId: meeting.id, status: { in: ACTIVE } },
  });
  if (existing) return ok(res, { ...serializeJob(existing), duplicate: true }, undefined, 200);

  const active = await prisma.processingJob.count({
    where: { status: { in: ACTIVE }, meeting: { createdById: req.user.id } },
  });
  if (active >= env.MAX_ACTIVE_JOBS_PER_USER) {
    throw tooMany(`You already have ${active} meetings being processed. Please wait for one to finish.`);
  }

  try {
    const job = await prisma.$transaction(async (tx) => {
      const j = await tx.processingJob.create({ data: { meetingId: meeting.id } });
      await tx.meeting.update({ where: { id: meeting.id }, data: { processingStatus: 'QUEUED' } });
      return j;
    });
    ok(res, serializeJob(job), undefined, 202);
  } catch (e) {
    // Lost a race with a concurrent request: the partial unique index guarantees one active job.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const j = await prisma.processingJob.findFirst({ where: { meetingId: meeting.id, status: { in: ACTIVE } } });
      if (j) return ok(res, { ...serializeJob(j), duplicate: true });
    }
    throw e;
  }
});

export const processingStatus = asyncHandler(async (req, res) => {
  const meeting = await getOwnedMeeting(req.params.id, req.user.id, {
    select: {
      id: true, processingStatus: true,
      jobs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  ok(res, {
    meetingStatus: meeting.processingStatus.toLowerCase(),
    stages: STAGES,
    job: serializeJob(meeting.jobs[0]),
  });
});

// ---- Minutes ----

export const getMinutes = asyncHandler(async (req, res) => {
  const meeting = await getOwnedMeeting(req.params.id, req.user.id, { include: { minutes: true } });
  if (!meeting.minutes) throw new AppError(404, 'NO_MINUTES', 'No minutes have been generated for this meeting yet.');
  ok(res, serializeMinutes(meeting.minutes));
});

export const patchMinutes = asyncHandler(async (req, res) => {
  const meeting = await getOwnedMeeting(req.params.id, req.user.id, { include: { minutes: true } });
  if (!meeting.minutes) throw new AppError(404, 'NO_MINUTES', 'No minutes have been generated for this meeting yet.');
  const b = req.body;
  const data = {
    ...(b.overview !== undefined && { overview: b.overview }),
    ...(b.key_points && { keyPoints: b.key_points }),
    ...(b.decisions && { decisions: b.decisions }),
    ...(b.risks && { risks: b.risks }),
    ...(b.open_questions && { openQuestions: b.open_questions }),
  };
  const updated = await prisma.meetingMinutes.update({ where: { meetingId: meeting.id }, data });
  ok(res, serializeMinutes(updated));
});

// ---- Export ----

export const exportMinutes = asyncHandler(async (req, res) => {
  const meeting = await getOwnedMeeting(req.params.id, req.user.id, {
    include: { minutes: true, actionItems: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
  });
  if (!meeting.minutes) throw new AppError(409, 'NO_MINUTES', 'Generate minutes before exporting.');
  const payload = { meeting, minutes: meeting.minutes, actionItems: meeting.actionItems };
  const name = safeFilename(meeting.title);
  try {
    if (req.query.format === 'md') {
      res.set({
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}.md"`,
      });
      return res.send(buildMarkdown(payload));
    }
    const pdf = await buildPdf(payload);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(500, 'EXPORT_FAILED', 'The export could not be generated. Please try again.');
  }
});
