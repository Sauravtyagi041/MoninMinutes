import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ClipboardPaste, FileText, ShieldCheck, Sparkles, UploadCloud, X } from 'lucide-react';
import { health, meetings, errorMessage, fieldErrors } from '../services/api.js';
import { useProcessing } from '../hooks/useProcessing.js';
import ProcessingProgress from '../components/ProcessingProgress.jsx';
import { Button, Card, Input, Modal, Select, Tabs, Textarea } from '../components/ui.jsx';
import { formatBytes, localTimezone, TIMEZONES, todayISO } from '../utils/format.js';

const EXTENSIONS = ['txt', 'md', 'srt', 'vtt'];
const DEFAULT_MAX = 5 * 1024 * 1024;

export const validateFile = (file, maxBytes = DEFAULT_MAX) => {
  if (!file) return 'Choose a file to upload.';
  const ext = file.name.split('.').pop().toLowerCase();
  if (!EXTENSIONS.includes(ext)) return 'Unsupported file type. Please upload a .txt, .md, .srt or .vtt file.';
  if (file.size === 0) return 'The selected file is empty.';
  if (file.size > maxBytes) return `File is too large (${formatBytes(file.size)}). The maximum size is ${formatBytes(maxBytes)}.`;
  return '';
};

export default function CreateMeeting() {
  const navigate = useNavigate();
  const fileInput = useRef(null);
  const submitting = useRef(false); // blocks double submits even before state updates render

  const [form, setForm] = useState({ title: '', meetingDate: todayISO(), timezone: localTimezone(), description: '', participants: '' });
  const [errors, setErrors] = useState({});
  const [tab, setTab] = useState('paste');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [maxBytes, setMaxBytes] = useState(DEFAULT_MAX);
  const [aiReady, setAiReady] = useState(true);

  const [confirming, setConfirming] = useState(false);
  const [phase, setPhase] = useState('form'); // form | starting | processing
  const [meetingId, setMeetingId] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    health().then(({ data }) => { setMaxBytes(data.maxFileBytes || DEFAULT_MAX); setAiReady(data.aiConfigured); }).catch(() => {});
  }, []);

  const { status, connectionLost } = useProcessing(meetingId, {
    enabled: phase === 'processing',
    onFinished: (s) => {
      if (s.job?.status === 'completed' || (!s.job && s.meetingStatus === 'completed')) {
        toast.success('Meeting minutes are ready');
        navigate(`/meetings/${meetingId}`);
      }
    },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const hasTranscript = tab === 'paste' ? text.trim().length > 0 : Boolean(file) && !fileError;
  const canSubmit = form.title.trim() && form.meetingDate && hasTranscript && phase === 'form';

  const pickFile = (f) => {
    setFile(f || null);
    setFileError(f ? validateFile(f, maxBytes) : '');
  };

  const meetingBody = () => ({
    title: form.title.trim(),
    meetingDate: form.meetingDate,
    timezone: form.timezone,
    description: form.description.trim() || null,
    participants: form.participants.split(',').map((s) => s.trim()).filter(Boolean),
  });

  const run = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setConfirming(false);
    setSubmitError('');
    setPhase('starting');
    try {
      let id = meetingId;
      if (id) await meetings.update(id, meetingBody());
      else {
        id = (await meetings.create(meetingBody())).data.id;
        setMeetingId(id);
      }
      if (tab === 'paste') await meetings.putTranscript(id, { text });
      else await meetings.uploadTranscript(id, file);
      await meetings.generate(id);
      setPhase('processing');
    } catch (e) {
      setErrors(fieldErrors(e));
      setSubmitError(errorMessage(e));
      setPhase('form');
    } finally {
      submitting.current = false;
    }
  };

  const retry = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setRetrying(true);
    try {
      await meetings.generate(meetingId); // transcript is already saved
      setPhase('starting');
      setTimeout(() => setPhase('processing'), 0);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      submitting.current = false;
      setRetrying(false);
    }
  };

  if (phase !== 'form') {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="p-6 sm:p-8">
          <ProcessingProgress status={status} connectionLost={connectionLost} starting={phase === 'starting'} onRetry={retry} retrying={retrying} />
          {status?.job?.status === 'failed' && (
            <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate(`/meetings/${meetingId}`)}>Open meeting instead</Button>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create meeting</h1>
        <p className="mt-1 text-sm text-muted">Add the meeting details and a transcript, and we’ll draft the minutes.</p>
      </div>

      {!aiReady && (
        <p role="alert" className="rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">
          AI processing isn’t configured on this server yet, so minutes can’t be generated. You can still save the transcript. See the README for setting <code>AI_API_KEY</code> and <code>AI_MODEL</code>.
        </p>
      )}
      {submitError && <p role="alert" className="rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">{submitError}</p>}

      <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) setConfirming(true); }} className="space-y-6" noValidate>
        <Card className="space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold">Meeting information</h2>
          <Input label="Title" placeholder="e.g. Sprint planning" value={form.title} onChange={set('title')} error={errors.title} maxLength={200} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Meeting date" type="date" value={form.meetingDate} onChange={set('meetingDate')} error={errors.meetingDate} required />
            <Select label="Timezone" value={form.timezone} onChange={set('timezone')} error={errors.timezone}>
              {(TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES]).map((z) => <option key={z}>{z}</option>)}
            </Select>
          </div>
          <Textarea label="Description (optional)" rows={2} value={form.description} onChange={set('description')} />
          <Input label="Participants (optional)" placeholder="Rahul, Priya, Karan" hint="Comma-separated. Helps the AI recognise names; it never assigns tasks from this list alone." value={form.participants} onChange={set('participants')} />
        </Card>

        <Card className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Transcript</h2>
            <Tabs label="Transcript source" value={tab} onChange={setTab} tabs={[{ id: 'paste', label: 'Paste transcript', icon: ClipboardPaste }, { id: 'upload', label: 'Upload file', icon: UploadCloud }]} />
          </div>

          {tab === 'paste' ? (
            <Textarea aria-label="Transcript text" rows={14} className="font-mono text-[13px]" placeholder={'[00:01:15] Rahul: The authentication API is ready.\n[00:02:30] Priya: I will test it tomorrow.'} value={text} onChange={(e) => setText(e.target.value)} hint="Speaker labels (“Name: text”) and timestamps are detected automatically." />
          ) : (
            <div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? 'border-brand bg-brand-soft' : 'border-line bg-surface-2/40'}`}
              >
                <UploadCloud className="mb-3 size-8 text-brand" aria-hidden />
                <p className="text-sm font-medium">Drag and drop a transcript here</p>
                <p className="mt-1 text-xs text-muted">TXT, MD, SRT or VTT · up to {formatBytes(maxBytes)}</p>
                <input ref={fileInput} data-testid="file-input" type="file" accept=".txt,.md,.srt,.vtt" className="sr-only" aria-label="Choose transcript file" onChange={(e) => pickFile(e.target.files?.[0])} />
                <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => fileInput.current?.click()}>Browse files</Button>
              </div>
              {file && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                  <FileText className="size-4 text-brand" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                  <span className="text-muted">{formatBytes(file.size)}</span>
                  <button type="button" aria-label="Remove file" onClick={() => { pickFile(null); if (fileInput.current) fileInput.current.value = ''; }} className="text-muted hover:text-ink cursor-pointer"><X className="size-4" /></button>
                </div>
              )}
              {fileError && <p role="alert" className="mt-2 text-sm text-bad">{fileError}</p>}
            </div>
          )}
        </Card>

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs text-muted sm:max-w-sm"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> The transcript is sent to the configured AI provider to generate minutes, and stored privately in your account.</p>
          <Button type="submit" size="lg" icon={Sparkles} disabled={!canSubmit}>Generate AI Meeting Minutes</Button>
        </div>
      </form>

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Send transcript to the AI provider?"
        footer={<><Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button><Button onClick={run} icon={Sparkles}>Send and generate</Button></>}>
        <p>To generate minutes, this transcript (plus the meeting title, date and participant names) will be sent to an external AI provider for analysis. It will also be saved in your private account. Don’t submit anything you’re not allowed to share with that provider.</p>
      </Modal>
    </div>
  );
}
