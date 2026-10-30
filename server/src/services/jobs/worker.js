import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { processJob } from './processor.js';

/** Atomically claims the oldest queued job; safe with several workers (SKIP LOCKED). */
export async function claimNext() {
  const rows = await prisma.$queryRaw`
    UPDATE "ProcessingJob"
       SET "status" = 'RUNNING',
           "attempts" = "attempts" + 1,
           "startedAt" = COALESCE("startedAt", now()),
           "heartbeatAt" = now()
     WHERE "id" = (
       SELECT "id" FROM "ProcessingJob"
        WHERE "status" = 'QUEUED'
        ORDER BY "createdAt"
        FOR UPDATE SKIP LOCKED
        LIMIT 1)
    RETURNING "id", "meetingId", "attempts"`;
  const job = rows[0];
  if (job) {
    await prisma.meeting.updateMany({ where: { id: job.meetingId }, data: { processingStatus: 'PROCESSING' } });
  }
  return job ?? null;
}

/** Jobs whose worker died (no heartbeat) are re-queued, or failed once attempts run out. */
export async function recoverStale(now = new Date()) {
  const cutoff = new Date(now.getTime() - env.JOB_STALE_MS);
  const stale = await prisma.processingJob.findMany({
    where: { status: 'RUNNING', heartbeatAt: { lt: cutoff } },
    select: { id: true, meetingId: true, attempts: true },
  });
  for (const j of stale) {
    if (j.attempts >= env.MAX_JOB_ATTEMPTS) {
      await prisma.processingJob.update({
        where: { id: j.id },
        data: {
          status: 'FAILED',
          errorCode: 'INTERRUPTED',
          errorMessage: 'Processing was interrupted repeatedly. Your transcript is saved, so you can retry.',
          completedAt: new Date(),
        },
      });
      await prisma.meeting.updateMany({ where: { id: j.meetingId }, data: { processingStatus: 'FAILED' } });
    } else {
      await prisma.processingJob.update({
        where: { id: j.id },
        data: { status: 'QUEUED', stage: null, completedStages: [] },
      });
      await prisma.meeting.updateMany({ where: { id: j.meetingId }, data: { processingStatus: 'QUEUED' } });
    }
  }
  return stale.length;
}

export async function cleanupOldJobs() {
  const cutoff = new Date(Date.now() - env.JOB_RETENTION_DAYS * 86_400_000);
  const { count } = await prisma.processingJob.deleteMany({
    where: { status: { in: ['COMPLETED', 'FAILED'] }, completedAt: { lt: cutoff } },
  });
  return count;
}

/** Claims and processes one job. Returns true if a job was handled. */
export async function runOnce(opts) {
  const job = await claimNext();
  if (!job) return false;
  const beat = setInterval(() => {
    prisma.processingJob
      .updateMany({ where: { id: job.id, status: 'RUNNING' }, data: { heartbeatAt: new Date() } })
      .catch(() => {});
  }, Math.max(1000, Math.floor(env.JOB_STALE_MS / 4)));
  try {
    await processJob(job, opts);
  } finally {
    clearInterval(beat);
  }
  return true;
}

let timer = null;
let busy = false;
let lastMaintenance = 0;

export function startWorker() {
  if (timer || !env.WORKER_ENABLED) return;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      if (Date.now() - lastMaintenance > 60_000) {
        lastMaintenance = Date.now();
        await recoverStale();
        await cleanupOldJobs();
      }
      while (await runOnce());
    } catch (e) {
      logger.error('worker tick failed', { name: e?.name, msg: e?.message });
    } finally {
      busy = false;
    }
  };
  timer = setInterval(tick, env.JOB_POLL_MS);
  tick();
  logger.info('worker started');
}

export function stopWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
