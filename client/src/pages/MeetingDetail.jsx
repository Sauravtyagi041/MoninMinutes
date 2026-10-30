import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Columns2, Download, FileText, Gavel, HelpCircle, ListChecks, MessageSquareText, Pencil, Plus, RefreshCw, Sparkles, Trash2, Users } from 'lucide-react';
import { actions as actionsApi, meetings as meetingsApi, errorMessage } from '../services/api.js';
import { useProcessing } from '../hooks/useProcessing.js';
import ActionItemEditor from '../components/ActionItemEditor.jsx';
import ActionItemsTable from '../components/ActionItemsTable.jsx';
import MinutesList from '../components/MinutesList.jsx';
import ProcessingProgress from '../components/ProcessingProgress.jsx';
import TranscriptViewer from '../components/TranscriptViewer.jsx';
import { MeetingStatusBadge } from '../components/badges.jsx';
import { Button, Card, EmptyState, ErrorState, Modal, PageLoader, Textarea } from '../components/ui.jsx';
import { downloadBlob, formatDate } from '../utils/format.js';

function Section({ icon: Icon, title, children, action, id }) {
  return (
    <Card className="p-5 sm:p-6" id={id} aria-labelledby={`${id}-h`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={`${id}-h`} className="flex items-center gap-2 text-base font-semibold"><Icon className="size-4 text-brand" aria-hidden />{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

export default function MeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);

  const [actionModal, setActionModal] = useState(null); // {item?}
  const [deleting, setDeleting] = useState(null); // action item | 'meeting'
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [exporting, setExporting] = useState('');

  const [split, setSplit] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [focus, setFocus] = useState({ id: null, ids: [] });

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const { data } = await meetingsApi.get(id);
      setMeeting(data);
      setProcessing(['queued', 'processing'].includes(data.processingStatus) || ['queued', 'running'].includes(data.latestJob?.status));
    } catch (e) {
      setError(e?.response?.status === 404 ? 'This meeting doesn’t exist or you don’t have access to it.' : errorMessage(e, 'Could not load this meeting.'));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const { status, connectionLost } = useProcessing(id, {
    enabled: processing,
    onFinished: (s) => {
      setProcessing(false);
      if (s.job?.status === 'completed') toast.success('Meeting minutes updated');
      else if (s.job?.status === 'failed') toast.error(s.job.errorMessage || 'Processing failed');
      load(true);
    },
  });

  const loadTranscript = useCallback(async () => {
    if (transcript) return;
    try {
      setTranscript((await meetingsApi.transcript(id)).data);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not load the transcript.'));
    }
  }, [id, transcript]);

  const viewSource = (segId, ids = [segId]) => {
    setSplit(true);
    loadTranscript();
    setFocus({ id: segId, ids });
  };
  const toggleSplit = () => {
    if (!split) loadTranscript();
    setSplit((s) => !s);
  };

  const minutes = meeting?.minutes;
  const saveMinutes = async (patch) => {
    try {
      const { data } = await meetingsApi.patchMinutes(id, patch);
      setMeeting((m) => ({ ...m, minutes: data }));
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save your changes.'));
      throw e;
    }
  };
  const saveSummary = async () => {
    if (!summaryDraft.trim()) return toast.error('The summary cannot be empty.');
    setSavingSummary(true);
    try {
      await saveMinutes({ overview: summaryDraft.trim() });
      setEditingSummary(false);
      toast.success('Summary saved');
    } catch { /* toasted */ } finally { setSavingSummary(false); }
  };

  const patchAction = async (actionId, body) => {
    const before = meeting.actionItems;
    setMeeting((m) => ({ ...m, actionItems: m.actionItems.map((a) => (a.id === actionId ? { ...a, ...body } : a)) }));
    try {
      const { data } = await actionsApi.update(actionId, body);
      setMeeting((m) => ({ ...m, actionItems: m.actionItems.map((a) => (a.id === actionId ? data : a)) }));
    } catch (e) {
      setMeeting((m) => ({ ...m, actionItems: before }));
      toast.error(errorMessage(e));
    }
  };
  const saveAction = async (body) => {
    try {
      if (actionModal.item) {
        const { data } = await actionsApi.update(actionModal.item.id, body);
        setMeeting((m) => ({ ...m, actionItems: m.actionItems.map((a) => (a.id === data.id ? data : a)) }));
        toast.success('Action item updated');
      } else {
        const { data } = await actionsApi.create(id, body);
        setMeeting((m) => ({ ...m, actionItems: [...m.actionItems, data] }));
        toast.success('Action item added');
      }
    } catch (e) {
      throw new Error(errorMessage(e), { cause: e });
    }
  };

  const confirmDelete = async () => {
    try {
      if (deleting === 'meeting') {
        await meetingsApi.remove(id);
        toast.success('Meeting deleted');
        navigate('/meetings');
      } else {
        await actionsApi.remove(deleting.id);
        setMeeting((m) => ({ ...m, actionItems: m.actionItems.filter((a) => a.id !== deleting.id) }));
        toast.success('Action item deleted');
        setDeleting(null);
      }
    } catch (e) {
      toast.error(errorMessage(e));
      setDeleting(null);
    }
  };

  const generate = async () => {
    setRegenBusy(true);
    try {
      await meetingsApi.generate(id);
      setConfirmRegen(false);
      setProcessing(true);
    } catch (e) {
      toast.error(errorMessage(e));
      setConfirmRegen(false);
    } finally {
      setRegenBusy(false);
    }
  };

  const doExport = async (format) => {
    setExporting(format);
    try {
      const res = await meetingsApi.exportFile(id, format);
      const name = (res.headers['content-disposition'] || '').match(/filename="([^"]+)"/)?.[1] || `minutes.${format}`;
      downloadBlob(res.data, name);
    } catch (e) {
      toast.error(e?.response?.status === 409 ? 'Generate minutes before exporting.' : e?.response ? 'The export could not be generated. Please try again.' : errorMessage(e));
    } finally {
      setExporting('');
    }
  };

  if (loading) return <PageLoader label="Loading meeting…" />;
  if (error || !meeting) return <Card><ErrorState message={error} onRetry={() => load()} /></Card>;

  const failedJob = meeting.latestJob?.status === 'failed' ? meeting.latestJob : null;
  const jobFailedLive = status?.job?.status === 'failed';
  const hasMinutes = Boolean(minutes);

  const main = (
    <div className="min-w-0 space-y-6">
      {processing && (
        <Card className="p-5 sm:p-6">
          <ProcessingProgress status={status} connectionLost={connectionLost} />
          {hasMinutes && <p className="mt-4 text-xs text-muted">Your current minutes stay visible below and are only replaced if this succeeds.</p>}
        </Card>
      )}
      {!processing && (failedJob || jobFailedLive) && (
        <div role="alert" className="flex flex-wrap items-start gap-3 rounded-xl border border-bad/30 bg-bad-soft p-4 text-sm text-bad">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">{(failedJob || status.job).errorMessage || 'Meeting analysis could not be completed. Your transcript is saved, so you can retry without uploading it again.'}</p>
          <Button size="sm" variant="secondary" loading={regenBusy} onClick={generate}>Retry</Button>
        </div>
      )}

      {!hasMinutes && !processing ? (
        <Card>
          <EmptyState icon={Sparkles} title={meeting.hasTranscript ? 'No minutes yet' : 'No transcript yet'}
            action={meeting.hasTranscript ? <Button icon={Sparkles} loading={regenBusy} onClick={() => setConfirmRegen(true)}>Generate minutes</Button> : <Link to="/meetings/new"><Button>Create a new meeting</Button></Link>}>
            {meeting.hasTranscript ? 'The transcript is saved. Generate AI minutes when you’re ready.' : 'This meeting has no transcript, so there is nothing to analyse.'}
          </EmptyState>
        </Card>
      ) : hasMinutes && (
        <>
          <Section id="summary" icon={MessageSquareText} title="Executive summary" action={!editingSummary && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" icon={Pencil} onClick={() => { setSummaryDraft(minutes.overview); setEditingSummary(true); }}>Edit</Button>
              <Button variant="ghost" size="sm" icon={RefreshCw} disabled={processing} onClick={() => setConfirmRegen(true)}>Regenerate</Button>
            </div>
          )}>
            {editingSummary ? (
              <div className="space-y-3">
                <Textarea aria-label="Executive summary" rows={5} value={summaryDraft} onChange={(e) => setSummaryDraft(e.target.value)} />
                <div className="flex gap-2"><Button loading={savingSummary} onClick={saveSummary}>Save changes</Button><Button variant="secondary" onClick={() => setEditingSummary(false)}>Cancel</Button></div>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{minutes.overview}</p>
                <p className="mt-3 text-xs text-muted">Generated by {minutes.modelName}</p>
              </>
            )}
          </Section>

          <Section id="key-points" icon={ListChecks} title="Key discussion points">
            <MinutesList items={minutes.key_points} emptyText="No key points were identified." addLabel="Add point" onSave={(v) => saveMinutes({ key_points: v })} onViewSource={viewSource} />
          </Section>
          <Section id="decisions" icon={Gavel} title="Decisions made">
            <MinutesList items={minutes.decisions} showOwner emptyText="No confirmed decisions were identified. Proposals and ideas are listed under key points." addLabel="Add decision" onSave={(v) => saveMinutes({ decisions: v })} onViewSource={viewSource} />
          </Section>
        </>
      )}

      {(hasMinutes || meeting.actionItems.length > 0) && (
        <Section id="actions" icon={ListChecks} title="Action items" action={<Button size="sm" variant="secondary" icon={Plus} onClick={() => setActionModal({})}>Add action item</Button>}>
          {meeting.actionItems.length === 0 ? <p className="text-sm text-muted">No action items were identified. You can add your own.</p> : (
            <div className="-mx-5 sm:-mx-6">
              <ActionItemsTable items={meeting.actionItems} onChange={patchAction} onEdit={(item) => setActionModal({ item })} onDelete={setDeleting} onViewSource={(sid) => viewSource(sid, [sid])} />
            </div>
          )}
        </Section>
      )}

      {hasMinutes && (
        <>
          <Section id="risks" icon={AlertTriangle} title="Risks and blockers">
            <MinutesList items={minutes.risks} emptyText="No risks or blockers were identified." addLabel="Add risk" onSave={(v) => saveMinutes({ risks: v })} onViewSource={viewSource} />
          </Section>
          <Section id="questions" icon={HelpCircle} title="Open questions">
            <MinutesList items={minutes.open_questions} emptyText="No open questions were identified." addLabel="Add question" onSave={(v) => saveMinutes({ open_questions: v })} onViewSource={viewSource} />
          </Section>
        </>
      )}

      {!split && meeting.hasTranscript && (
        <Section id="transcript" icon={FileText} title="Original transcript" action={<Button variant="secondary" size="sm" icon={Columns2} onClick={toggleSplit}>Show side by side</Button>}>
          <p className="text-sm text-muted">{meeting.segmentCount} segments · stored unchanged; editing minutes never modifies it.</p>
        </Section>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Link to="/meetings" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> All meetings</Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
            <MeetingStatusBadge status={meeting.processingStatus} />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span>{formatDate(meeting.meetingDate)} · {meeting.timezone}</span>
            {meeting.participants.length > 0 && <span className="flex items-center gap-1"><Users className="size-3.5" aria-hidden />{meeting.participants.join(', ')}</span>}
          </p>
          {meeting.description && <p className="mt-2 max-w-2xl text-sm text-muted">{meeting.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Download} disabled={!hasMinutes} loading={exporting === 'pdf'} onClick={() => doExport('pdf')}>PDF</Button>
          <Button variant="secondary" icon={Download} disabled={!hasMinutes} loading={exporting === 'md'} onClick={() => doExport('md')}>Markdown</Button>
          {meeting.hasTranscript && <Button variant="secondary" icon={Columns2} onClick={toggleSplit}>{split ? 'Hide transcript' : 'Transcript'}</Button>}
          <Button variant="danger" icon={Trash2} aria-label="Delete meeting" onClick={() => setDeleting('meeting')} />
        </div>
      </header>

      {split ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {main}
          <Card className="lg:sticky lg:top-4">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-brand" aria-hidden /> Original transcript</h2>
              <Button variant="ghost" size="sm" onClick={() => { setSplit(false); setFocus({ id: null, ids: [] }); }}>Close</Button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {transcript ? <TranscriptViewer segments={transcript.segments} highlight={focus.ids} focusId={focus.id} /> : <PageLoader label="Loading transcript…" />}
            </div>
          </Card>
        </div>
      ) : main}

      <ActionItemEditor open={Boolean(actionModal)} item={actionModal?.item} onClose={() => setActionModal(null)} onSave={saveAction} />

      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title={deleting === 'meeting' ? 'Delete this meeting?' : 'Delete action item?'}
        footer={<><Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={confirmDelete}>Delete</Button></>}>
        {deleting === 'meeting' ? 'The transcript, minutes and all action items will be permanently deleted.' : `“${deleting?.task}” will be permanently removed.`}
      </Modal>

      <Modal open={confirmRegen} onClose={() => setConfirmRegen(false)} title={hasMinutes ? 'Regenerate minutes?' : 'Generate minutes?'}
        footer={<><Button variant="secondary" onClick={() => setConfirmRegen(false)}>Cancel</Button><Button icon={Sparkles} loading={regenBusy} onClick={generate}>{hasMinutes ? 'Regenerate' : 'Generate'}</Button></>}>
        <p>The transcript will be sent to the configured external AI provider for analysis.</p>
        {hasMinutes && <p className="mt-2">Your current minutes stay in place until the new version succeeds. Action items you added or edited are kept; untouched AI-generated ones are replaced. Manual edits to the summary and lists will be overwritten.</p>}
      </Modal>
    </div>
  );
}
