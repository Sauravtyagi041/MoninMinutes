import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CalendarCheck, CheckCircle2, Clock, FileText, Layers, ListChecks, Sparkles } from 'lucide-react';
import { actions as actionsApi, dashboard, errorMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import MeetingsTable from '../components/MeetingsTable.jsx';
import { PriorityBadge } from '../components/badges.jsx';
import { Button, Card, EmptyState, ErrorState, Skeleton } from '../components/ui.jsx';
import { formatDate } from '../utils/format.js';

const CHART = [
  { key: 'pending', label: 'Pending', color: 'var(--muted)' },
  { key: 'in_progress', label: 'In Progress', color: 'var(--brand)' },
  { key: 'completed', label: 'Completed', color: 'var(--ok)' },
];

function Stat({ icon: Icon, label, value, loading }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <Icon className="size-4 text-brand" aria-hidden />
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="mt-2 text-3xl font-semibold tracking-tight" data-testid={`stat-${label}`}>{value}</p>}
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setStats((await dashboard.stats()).data);
    } catch (e) {
      setError(errorMessage(e, 'Could not load your dashboard.'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const complete = async (item) => {
    try {
      await actionsApi.update(item.id, { status: 'completed' });
      toast.success('Marked as completed');
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const loading = !stats && !error;
  const a = stats?.actionItems;
  const chart = stats ? CHART.map((c) => ({ ...c, value: a.byStatus[c.key] })) : [];
  const newUser = stats && stats.totalMeetings === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-muted">Here’s where your meetings and tasks stand.</p>
        </div>
        <Link to="/meetings/new"><Button icon={Sparkles}>Generate Minutes</Button></Link>
      </div>

      {error ? (
        <Card><ErrorState message={error} onRetry={load} /></Card>
      ) : newUser ? (
        <Card>
          <EmptyState icon={Sparkles} title="Let’s create your first minutes" action={<Link to="/meetings/new"><Button icon={Sparkles}>Create a meeting</Button></Link>}>
            Paste or upload a transcript and MinuteMate will extract the summary, decisions and action items.
          </EmptyState>
        </Card>
      ) : (
        <>
          <section aria-label="Statistics" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Stat loading={loading} icon={FileText} label="Meetings processed" value={stats?.meetingsProcessed} />
            <Stat loading={loading} icon={CalendarCheck} label="Processed this month" value={stats?.meetingsProcessedThisMonth} />
            <Stat loading={loading} icon={ListChecks} label="Total action items" value={a?.total} />
            <Stat loading={loading} icon={Clock} label="Pending action items" value={a?.pending} />
            <Stat loading={loading} icon={CheckCircle2} label="Completed action items" value={a?.completed} />
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5">
              <h2 className="text-base font-semibold">Action item completion</h2>
              {loading ? <Skeleton className="mt-4 h-48 w-full" /> : a.total === 0 ? (
                <p className="py-12 text-center text-sm text-muted">No action items yet.</p>
              ) : (
                <>
                  <div className="h-44" role="img" aria-label={`Pending ${a.byStatus.pending}, in progress ${a.byStatus.in_progress}, completed ${a.byStatus.completed}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chart} dataKey="value" nameKey="label" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                          {chart.map((c) => <Cell key={c.key} fill={c.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {chart.map((c) => (
                      <li key={c.key} className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: c.color }} />{c.label}</span>
                        <span className="font-medium">{c.value}</span>
                      </li>
                    ))}
                  </ul>
                  {a.overdue > 0 && <p className="mt-3 text-xs text-bad">{a.overdue} overdue</p>}
                </>
              )}
            </Card>

            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between border-b border-line p-4">
                <h2 className="text-base font-semibold">Pending action items</h2>
                <Link to="/action-items" className="text-sm text-brand hover:underline">View all</Link>
              </div>
              {loading ? <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div> : stats.pendingActionItems.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="All caught up">No open action items.</EmptyState>
              ) : (
                <ul className="divide-y divide-line">
                  {stats.pendingActionItems.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                      <input type="checkbox" aria-label={`Mark "${i.task}" as completed`} className="size-4 cursor-pointer accent-[var(--brand)]" onChange={() => complete(i)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{i.task}</p>
                        <p className="truncate text-xs text-muted">
                          <Link to={`/meetings/${i.meetingId}`} className="hover:underline">{i.meetingTitle}</Link> · {i.assignee || 'Not assigned'} · {i.dueDate ? <span className={i.overdue ? 'text-bad' : ''}>{formatDate(i.dueDate)}</span> : 'No deadline'}
                        </p>
                      </div>
                      <PriorityBadge priority={i.priority} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <MeetingsTable title="Recent meetings" pageSize={5} emptyAction={<Link to="/meetings/new"><Button icon={Layers}>Create meeting</Button></Link>} />
        </>
      )}
    </div>
  );
}
