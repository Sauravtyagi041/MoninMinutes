import { z } from 'zod';

const validTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'Not a valid calendar date.');

const emptyToNull = (schema) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), schema.nullable());

export const idParam = z.object({ id: z.string().min(1).max(64) });

export const registerBody = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(80),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.').max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter.')
    .regex(/\d/, 'Password must contain a number.'),
});

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Please enter your password.').max(128),
});

const meetingFields = {
  title: z.string().trim().min(1, 'Please enter a meeting title.').max(200),
  meetingDate: ymd.transform((s) => new Date(`${s}T12:00:00.000Z`)),
  timezone: z.string().refine(validTimezone, 'Unknown timezone.'),
  description: emptyToNull(z.string().trim().max(2000)).optional(),
  participants: z
    .array(z.string().trim().min(1).max(80))
    .max(50)
    .optional()
    .transform((a) => (a ? [...new Set(a)] : a)),
};
export const createMeetingBody = z.object(meetingFields);
export const updateMeetingBody = z.object(meetingFields).partial();

export const listMeetingsQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  sort: z.enum(['meetingDate', 'createdAt', 'title']).default('meetingDate'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export const transcriptBody = z.object({
  text: z.string().max(5_000_000),
  format: z.enum(['TEXT', 'MARKDOWN', 'SRT', 'VTT']).optional(),
  filename: z.string().max(255).optional(),
});

const item = z.object({
  text: z.string().trim().min(1).max(1500),
  segment_ids: z.array(z.number().int().positive()).max(30).default([]),
  owner: z.string().trim().max(120).nullable().optional(),
});
export const minutesBody = z
  .object({
    overview: z.string().trim().min(1, 'The summary cannot be empty.').max(2500),
    key_points: z.array(item).max(30),
    decisions: z.array(item).max(50),
    risks: z.array(item).max(50),
    open_questions: z.array(item).max(50),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update.');

const priority = z.enum(['low', 'medium', 'high']);
const status = z.enum(['pending', 'in_progress', 'completed']);

export const createActionBody = z.object({
  task: z.string().trim().min(1, 'Please describe the task.').max(600),
  assignee: emptyToNull(z.string().trim().max(120)).optional(),
  dueDate: emptyToNull(ymd).optional(),
  priority: priority.default('medium'),
  status: status.default('pending'),
});
export const updateActionBody = z
  .object({
    task: z.string().trim().min(1, 'Please describe the task.').max(600),
    assignee: emptyToNull(z.string().trim().max(120)),
    dueDate: emptyToNull(ymd),
    priority,
    status,
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update.');

export const listActionsQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: status.optional(),
  priority: priority.optional(),
  assignee: z.string().trim().max(120).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  meetingId: z.string().max(64).optional(),
  sort: z.enum(['dueDate', 'createdAt', 'priority']).default('dueDate'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export const exportQuery = z.object({ format: z.enum(['pdf', 'md']) });
