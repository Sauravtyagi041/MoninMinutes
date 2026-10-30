import { useEffect, useState } from 'react';
import { Moon, ShieldCheck, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { health } from '../services/api.js';
import { Badge, Button, Card } from '../components/ui.jsx';

export default function Settings() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [info, setInfo] = useState(null);
  useEffect(() => { health().then((r) => setInfo(r.data)).catch(() => setInfo({ error: true })); }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Card className="divide-y divide-line">
        <div className="p-5">
          <h2 className="font-semibold">Account</h2>
          <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-y-2 text-sm"><dt className="text-muted">Name</dt><dd>{user?.name}</dd><dt className="text-muted">Email</dt><dd>{user?.email}</dd></dl>
        </div>
        <div className="flex items-center justify-between p-5">
          <div><h2 className="font-semibold">Appearance</h2><p className="text-sm text-muted">Currently using the {theme} theme.</p></div>
          <Button variant="secondary" icon={theme === 'dark' ? Sun : Moon} onClick={toggle}>Switch to {theme === 'dark' ? 'light' : 'dark'}</Button>
        </div>
        <div className="p-5">
          <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-brand" aria-hidden /> AI &amp; privacy</h2>
          <p className="mt-2 text-sm text-muted">
            When you click <em>Generate</em>, the transcript text (and the meeting title, date and participant names) is sent from our server to the configured AI provider for analysis. Your API keys never reach the browser. Transcripts are stored privately in your account and are only visible to you; deleting a meeting permanently removes its transcript, minutes and action items from our database.
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm">
            AI status:{' '}
            {!info ? <Badge>Checking…</Badge> : info.error ? <Badge tone="bad">Unreachable</Badge> : info.aiConfigured ? <Badge tone="ok">Configured</Badge> : <Badge tone="warn">Not configured — see README</Badge>}
          </p>
        </div>
      </Card>
    </div>
  );
}
