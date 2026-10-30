import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api.js', async () => {
  const actual = await vi.importActual('../services/api.js');
  return {
    ...actual,
    health: vi.fn().mockResolvedValue({ data: { maxFileBytes: 5 * 1024 * 1024, aiConfigured: true } }),
    dashboard: { stats: vi.fn() },
    actions: { update: vi.fn(), list: vi.fn(), create: vi.fn(), remove: vi.fn() },
    meetings: { list: vi.fn(), create: vi.fn(), update: vi.fn(), putTranscript: vi.fn(), uploadTranscript: vi.fn(), generate: vi.fn(), status: vi.fn() },
  };
});
const api = await import('../services/api.js');
const { default: Login } = await import('../pages/Login.jsx');
const { default: CreateMeeting, validateFile } = await import('../pages/CreateMeeting.jsx');
const { default: Dashboard } = await import('../pages/Dashboard.jsx');
const { default: ActionItemsTable } = await import('../components/ActionItemsTable.jsx');
const { default: ProcessingProgress } = await import('../components/ProcessingProgress.jsx');
const { AuthProvider } = await import('../context/AuthContext.jsx');

const login = vi.fn();
vi.mock('../context/AuthContext.jsx', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ login, user: { name: 'Ada Lovelace' }, expired: false }),
}));

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
beforeEach(() => vi.clearAllMocks());

describe('Login form', () => {
  it('validates fields before calling the API', async () => {
    wrap(<Login />);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText('Please enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your password.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('shows the server error message on failure', async () => {
    login.mockRejectedValue({ response: { data: { error: { message: 'Incorrect email or password.' } } } });
    wrap(<Login />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  });
});

describe('Create meeting', () => {
  it('disables submit until title and transcript are present, then asks for AI confirmation', async () => {
    wrap(<CreateMeeting />);
    const submit = screen.getByRole('button', { name: /generate ai meeting minutes/i });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/title/i), 'Weekly sync');
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Transcript text'), 'Rahul: hi');
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    expect(await screen.findByRole('dialog')).toHaveTextContent(/sent to an external AI provider/i);
    expect(api.meetings.create).not.toHaveBeenCalled(); // nothing is sent before confirmation
  });

  it('submits once: create → transcript → generate, and shows processing steps from the backend', async () => {
    api.meetings.create.mockResolvedValue({ data: { id: 'm1' } });
    api.meetings.putTranscript.mockResolvedValue({});
    api.meetings.generate.mockResolvedValue({});
    api.meetings.status.mockResolvedValue({ data: { meetingStatus: 'processing', job: { status: 'running', stage: 'analyze', completedStages: ['validate', 'speakers'] } } });
    wrap(<CreateMeeting />);
    await userEvent.type(screen.getByLabelText(/title/i), 'Weekly sync');
    await userEvent.type(screen.getByLabelText('Transcript text'), 'Rahul: hi');
    await userEvent.click(screen.getByRole('button', { name: /generate ai meeting minutes/i }));
    const send = await screen.findByRole('button', { name: /send and generate/i });
    await userEvent.dblClick(send);
    await screen.findByText('Analyzing discussion');
    expect(api.meetings.create).toHaveBeenCalledTimes(1);
    expect(api.meetings.generate).toHaveBeenCalledTimes(1);
    const steps = screen.getAllByRole('listitem');
    expect(within(steps[0]).getByLabelText('Done')).toBeInTheDocument();
    expect(within(steps[2]).getByLabelText('In progress')).toBeInTheDocument();
    expect(within(steps[5]).getByLabelText('Pending')).toBeInTheDocument(); // not complete until the backend says so
  });

  it('shows a helpful error when the server rejects the transcript, keeping the form', async () => {
    api.meetings.create.mockResolvedValue({ data: { id: 'm1' } });
    api.meetings.putTranscript.mockRejectedValue({ response: { data: { error: { message: 'The transcript is empty.' } } } });
    wrap(<CreateMeeting />);
    await userEvent.type(screen.getByLabelText(/title/i), 'T');
    await userEvent.type(screen.getByLabelText('Transcript text'), 'x');
    await userEvent.click(screen.getByRole('button', { name: /generate ai meeting minutes/i }));
    await userEvent.click(await screen.findByRole('button', { name: /send and generate/i }));
    expect(await screen.findByText('The transcript is empty.')).toBeInTheDocument();
    expect(screen.getByLabelText('Transcript text')).toHaveValue('x');
  });

  it('validates uploaded files', () => {
    const f = (name, size) => ({ name, size });
    expect(validateFile(f('a.txt', 10))).toBe('');
    expect(validateFile(f('a.pdf', 10))).toMatch(/Unsupported/);
    expect(validateFile(f('a.txt', 0))).toMatch(/empty/);
    expect(validateFile(f('a.vtt', 6 * 1024 * 1024))).toMatch(/too large/);
  });
});

describe('ProcessingProgress', () => {
  it('shows a failure message and a retry button', async () => {
    const onRetry = vi.fn();
    render(<ProcessingProgress status={{ job: { status: 'failed', stage: 'analyze', completedStages: ['validate'], errorMessage: 'The AI provider is rate-limiting requests.' } }} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('rate-limiting');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('Action item editing', () => {
  const item = { id: 'a1', task: 'Fix login bug', assignee: null, dueDate: null, originalDueDateText: 'by Friday', priority: 'high', status: 'pending', confidence: 0.9, origin: 'ai', evidence: 'Fix it by Friday', sourceSegmentIds: [3], meetingId: 'm1' };

  it('renders unknown owner/deadline honestly and reports edits', async () => {
    const onChange = vi.fn(); const onEdit = vi.fn(); const onViewSource = vi.fn();
    wrap(<ActionItemsTable items={[item]} onChange={onChange} onEdit={onEdit} onDelete={vi.fn()} onViewSource={onViewSource} />);
    expect(screen.getByText('Not assigned')).toBeInTheDocument();
    expect(screen.getByText('“by Friday”')).toBeInTheDocument();
    expect(screen.getByText('90% confidence')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Status for Fix login bug'), 'completed');
    expect(onChange).toHaveBeenCalledWith('a1', { status: 'completed' });
    await userEvent.selectOptions(screen.getByLabelText('Priority for Fix login bug'), 'low');
    expect(onChange).toHaveBeenCalledWith('a1', { priority: 'low' });
    await userEvent.click(screen.getByRole('button', { name: 'Show evidence' }));
    expect(screen.getByText('Fix it by Friday')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '#3' }));
    expect(onViewSource).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Edit Fix login bug' }));
    expect(onEdit).toHaveBeenCalledWith(item);
  });

  it('flags overdue tasks only when the server marks them overdue', () => {
    wrap(<ActionItemsTable items={[{ ...item, dueDate: '2020-01-01', overdue: true }, { ...item, id: 'a2', task: 'No date', dueDate: null, overdue: false, originalDueDateText: null }]} onChange={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getAllByText('Overdue')).toHaveLength(1);
    expect(screen.getByText('No deadline')).toBeInTheDocument();
  });
});

describe('Dashboard', () => {
  const stats = {
    totalMeetings: 3, meetingsProcessed: 3, meetingsProcessedThisMonth: 2,
    actionItems: { total: 14, pending: 13, completed: 1, overdue: 3, byStatus: { pending: 10, in_progress: 3, completed: 1 } },
    recentMeetings: [], pendingActionItems: [{ id: 'a1', task: 'Ship API', meetingId: 'm1', meetingTitle: 'Sprint', assignee: 'Rahul', dueDate: null, priority: 'high', overdue: false }],
  };
  beforeEach(() => api.meetings.list.mockResolvedValue({ data: [], meta: { page: 1, totalPages: 1, total: 0 } }));

  it('renders statistics from the API', async () => {
    api.dashboard.stats.mockResolvedValue({ data: stats });
    wrap(<Dashboard />);
    expect(await screen.findByTestId('stat-Total action items')).toHaveTextContent('14');
    expect(screen.getByTestId('stat-Pending action items')).toHaveTextContent('13');
    expect(screen.getByTestId('stat-Completed action items')).toHaveTextContent('1');
    expect(screen.getByText('Welcome back, Ada')).toBeInTheDocument();
    expect(screen.getByText('Ship API')).toBeInTheDocument();
  });

  it('shows an empty state for new users and an error state with retry', async () => {
    api.dashboard.stats.mockResolvedValueOnce({ data: { ...stats, totalMeetings: 0, actionItems: { ...stats.actionItems, total: 0 } } });
    const { unmount } = wrap(<Dashboard />);
    expect(await screen.findByText(/create your first minutes/i)).toBeInTheDocument();
    unmount();
    api.dashboard.stats.mockRejectedValueOnce({ request: {} });
    wrap(<Dashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Cannot reach the server/);
    api.dashboard.stats.mockResolvedValueOnce({ data: stats });
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByTestId('stat-Total action items')).toBeInTheDocument());
  });
});
