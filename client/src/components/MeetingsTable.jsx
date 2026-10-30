import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Eye, FileText, Search } from 'lucide-react';
import { meetings as meetingsApi, errorMessage } from '../services/api.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { formatDate, MEETING_STATUS_LABEL } from '../utils/format.js';
import { MeetingStatusBadge } from './badges.jsx';
import { Button, Card, EmptyState, ErrorState, Pagination, Select, Skeleton } from './ui.jsx';

const SORTS = [
  { value: 'meetingDate', label: 'Meeting date' },
  { value: 'createdAt', label: 'Recently added' },
  { value: 'title', label: 'Title' },
];

/** Searchable, filterable, sortable, paginated meeting list backed by the API. */
export default function MeetingsTable({ pageSize = 10, title = 'Meetings', headerAction, emptyAction }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('meetingDate');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: null, rows: [], meta: null });
  const search = useDebounce(q);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await meetingsApi.list({ q: search || undefined, status: status || undefined, sort, order, page, pageSize });
      setState({ loading: false, error: null, rows: res.data, meta: res.meta });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: errorMessage(e, 'Could not load meetings.') }));
    }
  }, [search, status, sort, order, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = Boolean(search || status);
  const { loading, error, rows, meta } = state;

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              aria-label="Search meetings"
              placeholder="Search meetings"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="h-10 w-44 rounded-lg border border-line bg-surface pl-9 pr-3 text-sm placeholder:text-muted/70 sm:w-52"
            />
          </div>
          <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {Object.entries(MEETING_STATUS_LABEL).map(([v, l]) => <option key={v} value={v.toUpperCase()}>{l}</option>)}
          </Select>
          <Select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          <Button variant="secondary" aria-label={order === 'asc' ? 'Sort ascending' : 'Sort descending'} onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}>
            {order === 'asc' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
          </Button>
          {headerAction}
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading && !rows.length ? (
        <div className="space-y-3 p-4" role="status" aria-label="Loading meetings">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !rows.length ? (
        filtered ? (
          <EmptyState icon={Search} title="No meetings match">Try a different search or clear the filters.</EmptyState>
        ) : (
          <EmptyState icon={FileText} title="No meetings yet" action={emptyAction}>Create your first meeting and paste a transcript to generate minutes.</EmptyState>
        )
      ) : (
        <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">Meeting</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Action items</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-surface-2/60">
                  <td className="max-w-xs px-4 py-3 font-medium"><Link to={`/meetings/${m.id}`} className="hover:text-brand hover:underline">{m.title}</Link></td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(m.meetingDate)}</td>
                  <td className="px-4 py-3">{m.actionItemCount ?? 0}</td>
                  <td className="px-4 py-3"><MeetingStatusBadge status={m.processingStatus} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/meetings/${m.id}`}><Button variant="ghost" size="sm" icon={Eye} aria-label={`View details for ${m.title}`}>View</Button></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
    </Card>
  );
}
