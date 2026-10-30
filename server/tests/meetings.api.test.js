import { beforeEach, describe, expect, it } from 'vitest';
import { createMeeting, resetDb, signup } from './helpers/app.js';
import { prisma } from '../src/config/db.js';
import { SAMPLE_TRANSCRIPT } from './helpers/fixtures.js';

beforeEach(resetDb);

describe('meetings', () => {
  it('creates, lists with pagination/search, updates and deletes', async () => {
    const u = await signup();
    for (const t of ['Alpha sync', 'Beta review', 'Gamma retro']) await createMeeting(u, { title: t });
    const all = await u.get('/api/meetings?pageSize=2&sort=title&order=asc');
    expect(all.body.data.map((m) => m.title)).toEqual(['Alpha sync', 'Beta review']);
    expect(all.body.meta).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    const search = await u.get('/api/meetings?q=retro');
    expect(search.body.data).toHaveLength(1);

    const id = all.body.data[0].id;
    const patched = await u.patch(`/api/meetings/${id}`).send({ title: 'Alpha sync v2', participants: ['A', 'B', 'A'] });
    expect(patched.body.data).toMatchObject({ title: 'Alpha sync v2', participants: ['A', 'B'] });
    expect((await u.delete(`/api/meetings/${id}`)).status).toBe(200);
    expect((await u.get(`/api/meetings/${id}`)).status).toBe(404);
  });

  it('validates meeting input', async () => {
    const u = await signup();
    const r = await u.post('/api/meetings').send({ title: ' ', meetingDate: '2026-02-31', timezone: 'Mars/Base' });
    expect(r.status).toBe(400);
    expect(r.body.error.details.map((d) => d.field).sort()).toEqual(['meetingDate', 'timezone', 'title']);
  });

  it("never exposes another user's meeting, transcript, minutes, export, or action items", async () => {
    const a = await signup();
    const b = await signup();
    const m = await createMeeting(a);
    await a.post(`/api/meetings/${m.id}/transcript`).send({ text: SAMPLE_TRANSCRIPT });
    const item = (await a.post(`/api/meetings/${m.id}/action-items`).send({ task: 'Secret task' })).body.data;

    const probes = [
      b.get(`/api/meetings/${m.id}`),
      b.get(`/api/meetings/${m.id}/transcript`),
      b.get(`/api/meetings/${m.id}/minutes`),
      b.get(`/api/meetings/${m.id}/processing-status`),
      b.get(`/api/meetings/${m.id}/export?format=md`),
      b.patch(`/api/meetings/${m.id}`).send({ title: 'hacked' }),
      b.delete(`/api/meetings/${m.id}`),
      b.post(`/api/meetings/${m.id}/transcript`).send({ text: 'x: y' }),
      b.post(`/api/meetings/${m.id}/generate`),
      b.post(`/api/meetings/${m.id}/action-items`).send({ task: 'x' }),
      b.patch(`/api/action-items/${item.id}`).send({ task: 'hacked' }),
      b.delete(`/api/action-items/${item.id}`),
    ];
    for (const res of await Promise.all(probes)) expect(res.status).toBe(404);
    expect((await b.get('/api/meetings')).body.data).toEqual([]);
    expect((await b.get('/api/action-items')).body.data).toEqual([]);
    expect((await a.get(`/api/meetings/${m.id}`)).body.data.title).toBe('Sprint planning');
  });
});

describe('transcripts', () => {
  it('stores parsed segments for pasted text and keeps the original untouched', async () => {
    const u = await signup();
    const m = await createMeeting(u);
    const res = await u.post(`/api/meetings/${m.id}/transcript`).send({ text: SAMPLE_TRANSCRIPT });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ format: 'TEXT', segmentCount: 6, speakers: ['Rahul', 'Lead', 'Priya'] });
    const t = await u.get(`/api/meetings/${m.id}/transcript`);
    expect(t.body.data.original).toBe(SAMPLE_TRANSCRIPT);
    expect(t.body.data.segments[0]).toEqual({ segment_id: 1, speaker: 'Rahul', start_ms: 5000, end_ms: null, text: 'The authentication API is ready for testing.' });
  });

  it('accepts txt/md/srt/vtt uploads and detects format', async () => {
    const u = await signup();
    const m = await createMeeting(u);
    const srt = '1\n00:00:01,000 --> 00:00:03,000\nRahul: Hi all\n';
    const res = await u.post(`/api/meetings/${m.id}/transcript`).attach('file', Buffer.from(srt), 'call.srt');
    expect(res.status).toBe(201);
    expect(res.body.data.format).toBe('SRT');
    const vtt = await u.post(`/api/meetings/${m.id}/transcript`).attach('file', Buffer.from('WEBVTT\n\n00:01.000 --> 00:02.000\nHello'), 'call.vtt');
    expect(vtt.body.data.format).toBe('VTT');
  });

  it.each([
    ['empty text', (u, id) => u.post(`/api/meetings/${id}/transcript`).send({ text: '   ' }), 'empty'],
    ['unsupported file type', (u, id) => u.post(`/api/meetings/${id}/transcript`).attach('file', Buffer.from('hi'), 'a.pdf'), 'Unsupported file type'],
    ['empty file', (u, id) => u.post(`/api/meetings/${id}/transcript`).attach('file', Buffer.alloc(0), 'a.txt'), 'empty'],
    ['binary file', (u, id) => u.post(`/api/meetings/${id}/transcript`).attach('file', Buffer.from([0x50, 0x4b, 0, 3, 4]), 'a.txt'), 'binary'],
    ['malformed srt', (u, id) => u.post(`/api/meetings/${id}/transcript`).attach('file', Buffer.from('not an srt'), 'a.srt'), 'timing cues'],
  ])('rejects %s', async (_name, send, msg) => {
    const u = await signup();
    const m = await createMeeting(u);
    const res = await send(u, m.id);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(new RegExp(msg, 'i'));
  });

  it('rejects files over the size limit with 413', async () => {
    const u = await signup();
    const m = await createMeeting(u);
    const res = await u.post(`/api/meetings/${m.id}/transcript`).attach('file', Buffer.alloc(5 * 1024 * 1024 + 10, 'a'), 'big.txt');
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('refuses to replace the transcript while a job is active', async () => {
    const u = await signup();
    const m = await createMeeting(u);
    await u.post(`/api/meetings/${m.id}/transcript`).send({ text: SAMPLE_TRANSCRIPT });
    await prisma.processingJob.create({ data: { meetingId: m.id, status: 'RUNNING' } });
    const res = await u.post(`/api/meetings/${m.id}/transcript`).send({ text: 'A: b' });
    expect(res.status).toBe(409);
  });
});
