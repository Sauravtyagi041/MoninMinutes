import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select } from './ui.jsx';

const EMPTY = { task: '', assignee: '', dueDate: '', priority: 'medium', status: 'pending' };

/** Create / edit dialog for one action item. `onSave` receives API-shaped values. */
export default function ActionItemEditor({ open, item, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(item ? { task: item.task, assignee: item.assignee || '', dueDate: item.dueDate || '', priority: item.priority, status: item.status } : EMPTY);
      setError('');
    }
  }, [open, item]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.task.trim()) return setError('Please describe the task.');
    setBusy(true);
    try {
      await onSave({
        task: form.task.trim(),
        assignee: form.assignee.trim() || null,
        dueDate: form.dueDate || null,
        priority: form.priority,
        status: form.status,
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Could not save the action item.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit action item' : 'Add action item'}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Input label="Task" value={form.task} onChange={set('task')} error={error} autoFocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Assigned to" placeholder="Not assigned" value={form.assignee} onChange={set('assignee')} />
          <Input label="Due date" type="date" value={form.dueDate} onChange={set('dueDate')} hint={item?.originalDueDateText && !item.dueDate ? `Said in meeting: “${item.originalDueDateText}”` : undefined} />
          <Select label="Priority" value={form.priority} onChange={set('priority')}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </Select>
          <Select label="Status" value={form.status} onChange={set('status')}>
            <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>{item ? 'Save changes' : 'Add action item'}</Button>
        </div>
      </form>
    </Modal>
  );
}
