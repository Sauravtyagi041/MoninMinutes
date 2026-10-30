import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button, Input } from './ui.jsx';

/**
 * Editable list of {text, segment_ids, owner?} items (key points, decisions, risks, questions).
 * Text is rendered as plain text by React, so model output can never inject markup.
 */
export default function MinutesList({ items, emptyText, showOwner = false, onSave, onViewSource, addLabel }) {
  const [editing, setEditing] = useState(null); // index | 'new'
  const [draft, setDraft] = useState({ text: '', owner: '' });
  const [busy, setBusy] = useState(false);

  const begin = (i) => {
    setEditing(i);
    setDraft(i === 'new' ? { text: '', owner: '' } : { text: items[i].text, owner: items[i].owner || '' });
  };
  const commit = async (next) => {
    setBusy(true);
    try {
      await onSave(next);
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const text = draft.text.trim();
    if (!text) return;
    const item = { text, owner: showOwner ? draft.owner.trim() || null : undefined };
    if (editing === 'new') return commit([...items, { ...item, segment_ids: [] }]);
    commit(items.map((it, i) => (i === editing ? { ...it, ...item } : it)));
  };

  const editor = (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-end">
      <div className="flex-1"><Input aria-label="Text" label="Text" value={draft.text} onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))} autoFocus /></div>
      {showOwner && <div className="sm:w-40"><Input label="Owner" placeholder="None" value={draft.owner} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))} /></div>}
      <div className="flex gap-1">
        <Button size="md" loading={busy} onClick={save} aria-label="Save item" icon={Check}>Save</Button>
        <Button size="md" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel editing"><X className="size-4" /></Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {items.length === 0 && editing !== 'new' && <p className="text-sm text-muted">{emptyText}</p>}
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={`${i}-${it.text}`}>
            {editing === i ? editor : (
              <div className="group flex items-start gap-3 rounded-lg border border-line bg-surface-2/40 px-4 py-3">
                <div className="min-w-0 flex-1 text-sm">
                  <p>{it.text}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {showOwner && it.owner && <span>Owner: <strong className="text-ink">{it.owner}</strong></span>}
                    {it.segment_ids?.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1">
                        Evidence:
                        {it.segment_ids.map((id) => (
                          <button key={id} onClick={() => onViewSource?.(id, it.segment_ids)} className="rounded bg-brand-soft px-1.5 py-0.5 font-medium text-brand hover:underline cursor-pointer" aria-label={`View transcript line ${id}`}>#{id}</button>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button variant="ghost" size="sm" aria-label={`Edit: ${it.text}`} onClick={() => begin(i)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="sm" aria-label={`Remove: ${it.text}`} onClick={() => commit(items.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing === 'new' ? editor : (
        <Button variant="ghost" size="sm" icon={Plus} onClick={() => begin('new')}>{addLabel}</Button>
      )}
    </div>
  );
}
