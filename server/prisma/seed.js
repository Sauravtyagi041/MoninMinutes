// Demo data for local use. Creates one demo user and four meetings.
// Minutes for meetings 1-3 are HAND-WRITTEN demo content (modelName "demo-seed"),
// not AI output; meeting 4 has only a transcript so you can try real generation.
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { parseTranscript } from '../src/services/transcript/parser.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data in production.');
  process.exit(1);
}

const prisma = new PrismaClient();
const DEMO = { name: 'Demo User', email: 'demo@minutemate.ai', password: 'demo-password-123' };
const d = (s) => (s ? new Date(`${s}T00:00:00.000Z`) : null);
const lines = (rows) => rows.map(([ts, who, text]) => `[${ts}] ${who}: ${text}`).join('\n');

const meetings = [
  {
    title: 'Sprint Planning — Meeting Minutes API',
    meetingDate: '2026-10-19',
    timezone: 'Asia/Kolkata',
    description: 'Weekly sprint planning for the backend and dashboard teams.',
    participants: ['Anita', 'Rahul', 'Priya', 'Karan'],
    transcript: lines([
      ['00:00:10', 'Anita', "Let's start. The goal for this sprint is shipping the meeting minutes API and the dashboard. The sprint ends on Friday the 30th."],
      ['00:00:42', 'Rahul', 'The backend API is about seventy percent done. Auth and meeting CRUD are finished, the processing endpoint is still pending.'],
      ['00:01:15', 'Anita', 'Rahul, please finish the processing endpoint by Wednesday.'],
      ['00:01:25', 'Rahul', 'Sure, Wednesday works.'],
      ['00:01:50', 'Priya', "I'll build the dashboard stats cards and the recent meetings table. I can have the first version ready Thursday."],
      ['00:02:30', 'Karan', 'We have two open bugs: the login redirect loop and the date picker timezone issue.'],
      ['00:02:55', 'Anita', 'Rahul, can you take the login redirect bug as well?'],
      ['00:03:05', 'Rahul', "Yes, I'll pick it up. No firm date though, it depends on the endpoint work."],
      ['00:03:40', 'Karan', "The date picker bug, someone should look at it. I don't think it's blocking."],
      ['00:04:10', 'Priya', "Should we move the meeting list to Postgres full-text search? I think it'd be nicer than client-side filtering."],
      ['00:04:35', 'Anita', "Interesting, but let's park that. We'll revisit it in the next sprint planning."],
      ['00:05:00', 'Anita', "Decision: we're freezing scope. No new features after Wednesday, only bug fixes."],
      ['00:05:30', 'Karan', 'The staging database is still shared with the design team, which might cause flaky tests.'],
      ['00:05:50', 'Anita', 'Does anyone know who owns the staging database cleanup?'],
      ['00:06:10', 'Rahul', "Not sure. Let's find out."],
      ['00:06:30', 'Anita', 'Karan, run the full regression Friday morning before the release.'],
    ]),
    minutes: {
      overview:
        'The team planned the final sprint for the meeting minutes API and dashboard, with the sprint ending on the 30th. Scope was frozen after Wednesday so the remaining time goes to the processing endpoint, dashboard and bug fixes. Full-text search was floated but deferred, and ownership of the shared staging database remains unresolved.',
      key_points: [
        { text: 'Backend API is roughly 70% complete; the processing endpoint is the main remaining piece.', segment_ids: [2] },
        { text: 'Two bugs are open: a login redirect loop and a date picker timezone issue.', segment_ids: [6] },
        { text: 'Postgres full-text search for the meeting list was proposed and parked until next sprint planning.', segment_ids: [10, 11] },
      ],
      decisions: [{ text: 'Scope is frozen after Wednesday; only bug fixes will be accepted.', segment_ids: [12], owner: 'Anita' }],
      risks: [{ text: 'The staging database is shared with the design team, which may cause flaky tests.', segment_ids: [13] }],
      open_questions: [{ text: 'Who owns the staging database cleanup?', segment_ids: [14, 15] }],
    },
    actions: [
      { task: 'Finish the processing endpoint', assignee: 'Rahul', due: '2026-10-21', text: 'by Wednesday', priority: 'HIGH', status: 'IN_PROGRESS', ev: 'Rahul, please finish the processing endpoint by Wednesday.', ids: [3, 4], conf: 0.96 },
      { task: 'Build the dashboard stats cards and recent meetings table (first version)', assignee: 'Priya', due: '2026-10-22', text: 'Thursday', priority: 'MEDIUM', status: 'COMPLETED', ev: 'I can have the first version ready Thursday.', ids: [5], conf: 0.93 },
      { task: 'Fix the login redirect loop bug', assignee: 'Rahul', due: null, text: null, priority: 'HIGH', status: 'PENDING', ev: "Yes, I'll pick it up. No firm date though.", ids: [7, 8], conf: 0.88 },
      { task: 'Investigate the date picker timezone bug', assignee: null, due: null, text: null, priority: 'LOW', status: 'PENDING', ev: 'Someone should look at it.', ids: [9], conf: 0.62 },
      { task: 'Run the full regression before the release', assignee: 'Karan', due: '2026-10-23', text: 'Friday morning', priority: 'MEDIUM', status: 'PENDING', ev: 'Karan, run the full regression Friday morning before the release.', ids: [16], conf: 0.95 },
    ],
  },
  {
    title: 'Product Design Review',
    meetingDate: '2026-10-22',
    timezone: 'Asia/Kolkata',
    description: 'Review of dashboard designs, mobile layout and user feedback.',
    participants: ['Meera', 'Priya', 'Sam', 'Karan'],
    transcript: lines([
      ['00:00:05', 'Meera', "Thanks all. Today we're covering the new dashboard designs, mobile responsiveness, and the feedback from last week's user interviews."],
      ['00:00:40', 'Sam', 'In the interviews, five out of seven users said the action items table was hard to scan on a phone.'],
      ['00:01:10', 'Meera', 'So mobile responsiveness is the top priority. I propose collapsing the table into cards below 640 pixels.'],
      ['00:01:35', 'Priya', "Cards work for me, I'll implement them. It's about two days of work."],
      ['00:02:00', 'Sam', "Agreed, let's go with cards on mobile. That's decided."],
      ['00:02:30', 'Meera', "On colors, I'd like to try a lighter violet accent. I haven't tested the contrast yet."],
      ['00:02:55', 'Sam', "Maybe we should A/B test that? I'm not sure we have the traffic for it."],
      ['00:03:20', 'Meera', "Let's not decide now. I'll run a contrast check on the new accent."],
      ['00:03:45', 'Priya', 'The dark mode toggle flickers on first load.'],
      ['00:04:00', 'Meera', 'Priya, please fix the dark mode flicker by Monday.'],
      ['00:04:25', 'Sam', 'Meera, send the updated mockups to the whole team next Wednesday.'],
      ['00:04:50', 'Sam', "Design approval: I'm approving the dashboard layout as shown today. It's final."],
      ['00:05:15', 'Karan', 'Do we have the accessibility audit scheduled?'],
      ['00:05:25', 'Sam', 'Not yet.'],
      ['00:05:35', 'Meera', 'Someone needs to book the audit vendor.'],
    ]),
    minutes: {
      overview:
        'The team reviewed the new dashboard designs against user-interview feedback, which showed the action items table is hard to read on phones. They agreed to switch to a card layout on mobile and approved the dashboard layout. The lighter violet accent was not decided pending a contrast check, and the accessibility audit is not yet scheduled.',
      key_points: [
        { text: 'Five of seven interviewed users found the action items table hard to scan on a phone.', segment_ids: [2] },
        { text: 'A lighter violet accent was proposed; contrast has not been tested and an A/B test may lack traffic.', segment_ids: [6, 7, 8] },
        { text: 'The dark mode toggle flickers on first load.', segment_ids: [9] },
      ],
      decisions: [
        { text: 'Collapse the action items table into cards on mobile (below 640px).', segment_ids: [3, 5], owner: null },
        { text: 'The dashboard layout is approved as presented.', segment_ids: [12], owner: 'Sam' },
      ],
      risks: [{ text: 'The new accent colour may fail contrast requirements; it has not been tested.', segment_ids: [6] }],
      open_questions: [
        { text: 'Is there enough traffic to A/B test the new accent colour?', segment_ids: [7, 8] },
        { text: 'When will the accessibility audit be scheduled?', segment_ids: [13, 14] },
      ],
    },
    actions: [
      { task: 'Implement the mobile card layout for the action items table', assignee: 'Priya', due: null, text: null, priority: 'HIGH', status: 'IN_PROGRESS', ev: "Cards work for me, I'll implement them.", ids: [4], conf: 0.9 },
      { task: 'Fix the dark mode toggle flicker on first load', assignee: 'Priya', due: '2026-10-26', text: 'by Monday', priority: 'MEDIUM', status: 'PENDING', ev: 'Priya, please fix the dark mode flicker by Monday.', ids: [10], conf: 0.96 },
      { task: 'Send the updated mockups to the whole team', assignee: 'Meera', due: null, text: 'next Wednesday', priority: 'MEDIUM', status: 'PENDING', ev: 'Meera, send the updated mockups to the whole team next Wednesday.', ids: [11], conf: 0.92 },
      { task: 'Run a contrast check on the new violet accent', assignee: 'Meera', due: null, text: null, priority: 'LOW', status: 'PENDING', ev: "I'll run a contrast check on the new accent.", ids: [8], conf: 0.9 },
      { task: 'Book the accessibility audit vendor', assignee: null, due: null, text: null, priority: 'MEDIUM', status: 'PENDING', ev: 'Someone needs to book the audit vendor.', ids: [15], conf: 0.6 },
    ],
  },
  {
    title: 'Startup Team Discussion — Launch & Budget',
    meetingDate: '2026-10-26',
    timezone: 'Asia/Kolkata',
    description: 'Launch readiness, marketing strategy and quarterly budget.',
    participants: ['Neha', 'Arjun', 'Divya', 'Imran'],
    transcript: lines([
      ['00:00:08', 'Neha', "Our launch target is November 20th. Let's align on product readiness, marketing and budget."],
      ['00:00:40', 'Arjun', 'The product is feature-complete for the beta. What remains is the onboarding flow and the billing integration. Billing could slip.'],
      ['00:01:10', 'Neha', 'Arjun, the onboarding flow must be done by November 6th.'],
      ['00:01:18', 'Arjun', 'Understood, November 6th.'],
      ['00:01:45', 'Divya', 'The marketing plan: a Product Hunt launch, a LinkedIn campaign, and three founder-led webinars.'],
      ['00:02:20', 'Neha', "Product Hunt and LinkedIn are approved. Let's hold off on the webinars until we know the budget."],
      ['00:02:50', 'Imran', 'On budget, we have twelve lakh rupees left for the quarter. Marketing asked for five lakh, which leaves little for infrastructure.'],
      ['00:03:20', 'Neha', "Let's cap marketing at three lakh for now. That's final."],
      ['00:03:40', 'Divya', "Then I'll have to cut paid ads. I'll send a revised plan by November 2nd."],
      ['00:04:05', 'Imran', "I'll prepare the cash-flow forecast and share it sometime next week."],
      ['00:04:30', 'Neha', 'Maybe we should consider a pricing change before launch? Does anyone have data?'],
      ['00:04:45', 'Arjun', "I don't have any data. Imran, maybe you do?"],
      ['00:04:55', 'Imran', 'Not yet.'],
      ['00:05:15', 'Neha', 'Someone should set up the launch-day support rota.'],
      ['00:05:40', 'Arjun', "The billing vendor hasn't confirmed API access yet. That's our biggest risk."],
    ]),
    minutes: {
      overview:
        'The founders reviewed readiness for the November 20th launch. The onboarding flow is due on November 6th while billing may slip, and the marketing plan was narrowed to Product Hunt and LinkedIn with a three-lakh budget cap. A possible pricing change and the launch-day support rota are still open.',
      key_points: [
        { text: 'The product is feature-complete for beta; onboarding and billing integration remain.', segment_ids: [2] },
        { text: 'Twelve lakh rupees remain for the quarter; marketing requested five lakh.', segment_ids: [7] },
        { text: 'Paid ads will be cut to fit the reduced marketing budget.', segment_ids: [9] },
      ],
      decisions: [
        { text: 'Product Hunt and LinkedIn campaigns are approved; webinars are on hold until budget is clear.', segment_ids: [6], owner: 'Neha' },
        { text: 'Marketing spend is capped at three lakh rupees for now.', segment_ids: [8], owner: 'Neha' },
      ],
      risks: [
        { text: 'The billing integration could slip.', segment_ids: [2] },
        { text: 'The billing vendor has not yet confirmed API access.', segment_ids: [15] },
      ],
      open_questions: [{ text: 'Should pricing change before launch? No data is available yet.', segment_ids: [11, 12, 13] }],
    },
    actions: [
      { task: 'Complete the onboarding flow', assignee: 'Arjun', due: '2026-11-06', text: 'November 6th', priority: 'HIGH', status: 'IN_PROGRESS', ev: 'Arjun, the onboarding flow must be done by November 6th.', ids: [3, 4], conf: 0.97 },
      { task: 'Send a revised marketing plan without paid ads', assignee: 'Divya', due: '2026-11-02', text: 'November 2nd', priority: 'MEDIUM', status: 'PENDING', ev: "I'll send a revised plan by November 2nd.", ids: [9], conf: 0.95 },
      { task: 'Prepare and share the cash-flow forecast', assignee: 'Imran', due: null, text: 'sometime next week', priority: 'MEDIUM', status: 'PENDING', ev: "I'll prepare the cash-flow forecast and share it sometime next week.", ids: [10], conf: 0.9 },
      { task: 'Set up the launch-day support rota', assignee: null, due: null, text: null, priority: 'MEDIUM', status: 'PENDING', ev: 'Someone should set up the launch-day support rota.', ids: [14], conf: 0.6 },
    ],
  },
  {
    title: 'Customer Feedback Sync (ready to generate)',
    meetingDate: '2026-10-29',
    timezone: 'Asia/Kolkata',
    description: 'Transcript only: add your AI key and click Generate to see real analysis.',
    participants: ['Neha', 'Divya'],
    transcript: lines([
      ['00:00:05', 'Neha', 'Quick sync on customer feedback from the beta group.'],
      ['00:00:30', 'Divya', 'Most requests are about CSV export and calendar integration. Export is the most common one.'],
      ['00:01:00', 'Neha', 'Divya, please compile the top ten requests into a doc by Friday.'],
      ['00:01:20', 'Divya', 'Will do.'],
      ['00:01:45', 'Neha', 'We agreed to prioritise CSV export for the next release. Calendar integration is a maybe.'],
    ]),
    minutes: null,
  },
];

async function main() {
  await prisma.user.deleteMany({ where: { email: DEMO.email } });
  const user = await prisma.user.create({
    data: { name: DEMO.name, email: DEMO.email, passwordHash: await bcrypt.hash(DEMO.password, 12) },
  });

  for (const m of meetings) {
    const segments = parseTranscript(m.transcript, 'TEXT');
    await prisma.meeting.create({
      data: {
        title: m.title,
        description: m.description,
        participants: m.participants,
        meetingDate: new Date(`${m.meetingDate}T12:00:00.000Z`),
        timezone: m.timezone,
        createdById: user.id,
        originalTranscript: m.transcript,
        transcriptFormat: 'TEXT',
        processingStatus: m.minutes ? 'COMPLETED' : 'DRAFT',
        segments: {
          create: segments.map((s) => ({
            segmentIndex: s.segment_id, speaker: s.speaker, text: s.text, startMs: s.start_ms, endMs: s.end_ms,
          })),
        },
        ...(m.minutes && {
          minutes: {
            create: {
              overview: m.minutes.overview,
              keyPoints: m.minutes.key_points,
              decisions: m.minutes.decisions,
              risks: m.minutes.risks,
              openQuestions: m.minutes.open_questions,
              modelName: 'demo-seed (hand-written, not AI output)',
            },
          },
          jobs: { create: { status: 'COMPLETED', completedAt: new Date(), completedStages: ['validate', 'speakers', 'analyze', 'extract', 'prepare', 'save'] } },
          actionItems: {
            create: (m.actions ?? []).map((a) => ({
              task: a.task, assignee: a.assignee, dueDate: d(a.due), originalDueDateText: a.text,
              priority: a.priority, status: a.status, evidence: a.ev, sourceSegmentIds: a.ids, confidence: a.conf,
            })),
          },
        }),
      },
    });
  }
  console.log(`Seeded ${meetings.length} meetings for ${DEMO.email} / ${DEMO.password}`);
}

main().finally(() => prisma.$disconnect());
