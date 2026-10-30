import { Router } from 'express';
import { prisma } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { csrfProtect } from '../middleware/csrf.js';
import { authLimiter, generateLimiter } from '../middleware/rateLimit.js';
import { isAiConfigured } from '../services/ai/providers.js';
import { env } from '../config/env.js';
import * as s from '../validators/schemas.js';
import * as auth from '../controllers/auth.js';
import * as meetings from '../controllers/meetings.js';
import * as actions from '../controllers/actionItems.js';
import * as dashboard from '../controllers/dashboard.js';

const r = Router();

r.get(
  '/health',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    ok(res, { status: 'ok', aiConfigured: isAiConfigured(), maxFileBytes: env.MAX_FILE_BYTES });
  }),
);

// Auth
r.post('/auth/register', authLimiter, validate({ body: s.registerBody }), auth.register);
r.post('/auth/login', authLimiter, validate({ body: s.loginBody }), auth.login);
r.post('/auth/logout', auth.logout);
r.get('/auth/me', requireAuth, auth.me);

// Everything below requires a session and, for writes, a CSRF token.
const priv = [requireAuth, csrfProtect];
const id = validate({ params: s.idParam });

r.get('/meetings', requireAuth, validate({ query: s.listMeetingsQuery }), meetings.list);
r.post('/meetings', ...priv, validate({ body: s.createMeetingBody }), meetings.create);
r.get('/meetings/:id', requireAuth, id, meetings.get);
r.patch('/meetings/:id', ...priv, id, validate({ body: s.updateMeetingBody }), meetings.update);
r.delete('/meetings/:id', ...priv, id, meetings.remove);

r.post('/meetings/:id/transcript', ...priv, id, meetings.upload, meetings.putTranscript);
r.get('/meetings/:id/transcript', requireAuth, id, meetings.getTranscript);

r.post('/meetings/:id/generate', ...priv, generateLimiter, id, meetings.generate);
r.get('/meetings/:id/processing-status', requireAuth, id, meetings.processingStatus);

r.get('/meetings/:id/minutes', requireAuth, id, meetings.getMinutes);
r.patch('/meetings/:id/minutes', ...priv, id, validate({ body: s.minutesBody }), meetings.patchMinutes);

r.get('/meetings/:id/export', requireAuth, id, validate({ query: s.exportQuery }), meetings.exportMinutes);

r.get('/action-items', requireAuth, validate({ query: s.listActionsQuery }), actions.list);
r.post('/meetings/:id/action-items', ...priv, id, validate({ body: s.createActionBody }), actions.create);
r.patch('/action-items/:id', ...priv, id, validate({ body: s.updateActionBody }), actions.update);
r.delete('/action-items/:id', ...priv, id, actions.remove);

r.get('/dashboard/stats', requireAuth, dashboard.stats);

export default r;
