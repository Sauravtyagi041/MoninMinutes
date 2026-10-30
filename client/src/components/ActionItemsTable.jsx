import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Pencil, Quote, Trash2 } from 'lucide-react';
import { formatDate } from '../utils/format.js';
import { Badge, Button } from './ui.jsx';

const STATUSES = [['pending', 'Pending'], ['in_progress', 'In Progress'], ['completed', 'Completed']];
const PRIORITIES = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
const selectCls = 'h-8 cursor-pointer rounded-md border border-line bg-surface px-2 text-xs text-ink';

export default function ActionItemsTable({ items, showMeeting = false, onChange, onEdit, onDelete, onViewSource }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const cols = showMeeting ? 7 : 6;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-4 py-3 font-medium">Task</th>
            {showMeeting && <th className="px-4 py-3 font-medium">Meeting</th>}
            <th className="px-4 py-3 font-medium">Assigned To</th>
            <th className="px-4 py-3 font-medium">Due Date</th>
            <th className="px-4 py-3 font-medium">Priority</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((a) => {
            const expanded = open.has(a.id);
            const hasSource = a.evidence || a.sourceSegmentIds?.length;
            return (
              <Fragment key={a.id}>
                <tr className={a.status === 'completed' ? 'opacity-70' : ''}>
                  <td className="max-w-sm px-4 py-3">
                    <div className="flex items-start gap-1.5">
                      {hasSource ? (
                        <button aria-label={expanded ? 'Hide evidence' : 'Show evidence'} aria-expanded={expanded} onClick={() => toggle(a.id)} className="mt-0.5 rounded p-0.5 text-muted hover:text-ink cursor-pointer">
                          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </button>
                      ) : <span className="w-5" />}
                      <div>
                        <p className={`font-medium ${a.status === 'completed' ? 'line-through' : ''}`}>{a.task}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {a.origin === 'manual' && <Badge>Manual</Badge>}
                          {a.confidence != null && <Badge tone={a.confidence >= 0.8 ? 'ok' : 'warn'}>{Math.round(a.confidence * 100)}% confidence</Badge>}
                        </div>
                      </div>
                    </div>
                  </td>
                  {showMeeting && (
                    <td className="px-4 py-3"><Link to={`/meetings/${a.meetingId}`} className="text-brand hover:underline">{a.meetingTitle}</Link></td>
                  )}
                  <td className="px-4 py-3">{a.assignee || <span className="text-muted">Not assigned</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {a.dueDate ? (
                      <span className={a.overdue ? 'font-medium text-bad' : ''}>
                        {formatDate(a.dueDate)}{a.overdue && <Badge tone="bad" className="ml-2">Overdue</Badge>}
                      </span>
                    ) : (
                      <span className="text-muted" title={a.originalDueDateText ? 'Mentioned in the meeting but could not be resolved to a calendar date' : undefined}>
                        {a.originalDueDateText ? `“${a.originalDueDateText}”` : 'No deadline'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select aria-label={`Priority for ${a.task}`} className={selectCls} value={a.priority} onChange={(e) => onChange(a.id, { priority: e.target.value })}>
                      {PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select aria-label={`Status for ${a.task}`} className={selectCls} value={a.status} onChange={(e) => onChange(a.id, { status: e.target.value })}>
                      {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" aria-label={`Edit ${a.task}`} onClick={() => onEdit(a)}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${a.task}`} onClick={() => onDelete(a)}><Trash2 className="size-4" /></Button>
                    </div>
                  </td>
                </tr>
                {expanded && (
                  <tr className="bg-surface-2/50">
                    <td colSpan={cols} className="px-4 py-3 pl-11">
                      {a.evidence && <p className="flex gap-2 text-sm italic text-muted"><Quote className="mt-0.5 size-4 shrink-0" aria-hidden />{a.evidence}</p>}
                      {a.sourceSegmentIds?.length > 0 && onViewSource && (
                        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                          Transcript:
                          {a.sourceSegmentIds.map((id) => (
                            <button key={id} onClick={() => onViewSource(id)} className="rounded bg-brand-soft px-1.5 py-0.5 font-medium text-brand hover:underline cursor-pointer">#{id}</button>
                          ))}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
