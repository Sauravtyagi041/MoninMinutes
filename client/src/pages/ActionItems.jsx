import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ListChecks, Search } from 'lucide-react';
import { actions as actionsApi, errorMessage } from '../services/api.js';
import { useDebounce } from '../hooks/useDebounce.js';
import ActionItemEditor from '../components/ActionItemEditor.jsx';
import ActionItemsTable from '../components/ActionItemsTable.jsx';
import { Button, Card, EmptyState, ErrorState, Modal, Pagination, Select, Skeleton } from '../components/ui.jsx';

export default function ActionItems() {
  const [f, setF] = useState({ q: '', status: '', priority: '', assignee: '', overdue: false, sort: 'dueDate', order: 'asc' });
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: '', items: [], meta: null });
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const q = useDebounce(f.q);
  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.value })); setPage(1); };

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await actionsApi.list({
        q: q || undefined, status: f.status || undefined, priority: f.priority || undefined,
        assignee: f.assignee || undefined, overdue: f.overdue ? 'true' : undefined,
        sort: f.sort, order: f.order, page, pageSize: 20,
      });
      setState({ loading: false, error: '', items: res.data, meta: res.meta });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: errorMessage(e, 'Could not load action items.') }));
    }
  }, [q, f.status, f.priority, f.assignee, f.overdue, f.sort, f.order, page]);
  useEffect(() => { load(); }, [load]);

  const patch = async (id, body) => {
    try {
      await actionsApi.update(id, body);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const confirmDelete = async () => {
    try {
      await actionsApi.remove(deleting.id);
      toast.success('Action item deleted');
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const { items, meta, loading, error } = state;
  const stats = meta?.stats;
  const filtered = Boolean(q || f.status || f.priority || f.assignee || f.overdue);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Action items</h1>

      <section aria-label="Task statistics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[['Total', stats?.total], ['Completed', stats?.completed], ['Pending', stats?.pending], ['Overdue', stats?.overdue]].map(([label, v]) => (
          <Card key={label} className="p-5">
            <p className="text-sm text-muted">{label} tasks</p>
            <p className={`mt-2 text-3xl font-semibold ${label === 'Overdue' && v > 0 ? 'text-bad' : ''}`}>{v ?? '–'}</p>
          </Card>
        ))}
      </section>

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input aria-label="Search tasks" placeholder="Search tasks" value={f.q} onChange={set('q')} className="h-10 w-52 rounded-lg border border-line bg-surface pl-9 pr-3 text-sm placeholder:text-muted/70" />
          </div>
          <Select aria-label="Filter by status" value={f.status} onChange={set('status')}>
            <option value="">All statuses</option><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
          </Select>
          <Select aria-label="Filter by priority" value={f.priority} onChange={set('priority')}>
            <option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </Select>
          <Select aria-label="Filter by assignee" value={f.assignee} onChange={set('assignee')}>
            <option value="">Everyone</option>
            {(meta?.assignees || []).map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          <Select aria-label="Sort by" value={`${f.sort}:${f.order}`} onChange={(e) => { const [sort, order] = e.target.value.split(':'); setF((s) => ({ ...s, sort, order })); }}>
            <option value="dueDate:asc">Deadline (soonest)</option><option value="dueDate:desc">Deadline (latest)</option>
            <option value="priority:desc">Priority</option><option value="createdAt:desc">Newest</option>
          </Select>
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.overdue} onChange={(e) => { setF((s) => ({ ...s, overdue: e.target.checked })); setPage(1); }} /> Overdue only
          </label>
        </div>

        {error ? <ErrorState message={error} onRetry={load} /> : loading && !items.length ? (
          <div className="space-y-3 p-4" role="status" aria-label="Loading action items">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !items.length ? (
          filtered ? <EmptyState icon={Search} title="No tasks match these filters" /> : <EmptyState icon={ListChecks} title="No action items yet">Action items from your meetings will show up here.</EmptyState>
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : ''}>
            <ActionItemsTable items={items} showMeeting onChange={patch} onEdit={setEditing} onDelete={setDeleting} />
          </div>
        )}
        <Pagination meta={meta} onPage={setPage} />
      </Card>

      <ActionItemEditor
        open={Boolean(editing)}
        item={editing}
        onClose={() => setEditing(null)}
        onSave={async (body) => {
          try { await actionsApi.update(editing.id, body); toast.success('Action item updated'); load(); }
          catch (e) { throw new Error(errorMessage(e), { cause: e }); }
        }}
      />
      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete action item?"
        footer={<><Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={confirmDelete}>Delete</Button></>}>
        “{deleting?.task}” will be permanently removed.
      </Modal>
      {!loading && !error && items.length > 0 && <p className="sr-only" role="status"><CheckCircle2 /> {meta?.total} tasks</p>}
    </div>
  );
}
