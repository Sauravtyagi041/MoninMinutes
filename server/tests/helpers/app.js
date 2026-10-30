import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/db.js';

export const app = createApp();

export async function resetDb() {
  await prisma.$executeRawUnsafe('TRUNCATE "User" CASCADE');
}

let n = 0;
/** Registers a user and returns an agent that sends the CSRF header automatically. */
export async function signup(overrides = {}) {
  n += 1;
  const agent = request.agent(app);
  const creds = { name: 'Test User', email: `user${n}-${Date.now()}@example.com`, password: 'password123', ...overrides };
  const res = await agent.post('/api/auth/register').send(creds);
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  const csrf = res.body.data.csrfToken;
  const wrap = (method) => (url) => agent[method](url).set('X-CSRF-Token', csrf);
  return {
    agent,
    creds,
    user: res.body.data.user,
    csrf,
    get: (url) => agent.get(url),
    post: wrap('post'),
    patch: wrap('patch'),
    put: wrap('put'),
    delete: wrap('delete'),
  };
}

export async function createMeeting(u, body = {}) {
  const res = await u.post('/api/meetings').send({
    title: 'Sprint planning', meetingDate: '2026-10-28', timezone: 'Asia/Kolkata', ...body,
  });
  if (res.status !== 201) throw new Error(`createMeeting failed: ${JSON.stringify(res.body)}`);
  return res.body.data;
}
