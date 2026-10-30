import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CheckCircle2, ClipboardList, FileDown, Gavel, HelpCircle, Moon, ShieldCheck, Sun, Upload, Wand2, AlertTriangle } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { Badge, Button } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const FEATURES = [
  { icon: ClipboardList, title: 'Executive summaries', body: 'A concise 2–5 sentence overview of what the meeting was about and what came out of it.' },
  { icon: Gavel, title: 'Confirmed decisions only', body: 'Proposals and ideas stay separate from what the group actually agreed.' },
  { icon: CheckCircle2, title: 'Owners and deadlines', body: 'Action items with assignees and due dates — left blank when nobody said, never guessed.' },
  { icon: ShieldCheck, title: 'Evidence for everything', body: 'Every point links back to the transcript lines it came from, so you can verify in a click.' },
  { icon: HelpCircle, title: 'Risks and open questions', body: 'Blockers and unanswered questions are surfaced so nothing quietly slips.' },
  { icon: FileDown, title: 'Edit and export', body: 'Fix anything, track progress across meetings, then download polished PDF or Markdown minutes.' },
];

const STEPS = [
  { icon: Upload, title: 'Add a transcript', body: 'Paste text or drop a TXT, MD, SRT or VTT file.' },
  { icon: Wand2, title: 'Generate minutes', body: 'The AI extracts structure and cites its sources.' },
  { icon: CalendarClock, title: 'Review and track', body: 'Edit, assign, export, and follow tasks to done.' },
];

export default function Landing() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const cta = user ? '/meetings/new' : '/register';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-2" aria-label="Site">
            <a href="#features" className="hidden px-3 text-sm text-muted hover:text-ink sm:block">Features</a>
            <a href="#how" className="hidden px-3 text-sm text-muted hover:text-ink sm:block">How it works</a>
            <button onClick={toggle} aria-label="Toggle theme" className="rounded-lg p-2 text-muted hover:bg-surface-2 cursor-pointer">
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            {user ? (
              <Link to="/dashboard"><Button size="sm">Open dashboard</Button></Link>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
                <Link to="/register"><Button size="sm">Get started</Button></Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(50rem 24rem at 50% -5%, color-mix(in srgb, var(--brand) 22%, transparent), transparent 70%)' }} />
          <div className="mx-auto max-w-4xl px-4 pb-20 pt-20 text-center sm:pt-28">
            <Badge tone="brand" className="mb-6">Turn conversations into clarity</Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Your Meetings. <span className="text-brand">Summarized.</span> Organized. Actionable.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
              Convert lengthy meeting transcripts into clear summaries, actionable tasks, and organized decisions in seconds.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to={cta}><Button size="lg" icon={Wand2}>Generate Meeting Minutes</Button></Link>
              <a href="#features"><Button size="lg" variant="secondary">Explore Features</Button></a>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight">Everything from “we should…” to “done”</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted">Built to extract what was actually said — and to be honest about what wasn’t.</p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-line bg-surface p-6 transition-shadow hover:shadow-md">
                <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon className="size-5" aria-hidden /></div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-center text-3xl font-bold tracking-tight">Three steps</h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="text-center">
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand text-brand-ink"><Icon className="size-5" aria-hidden /></div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand">Step {i + 1}</p>
                  <h3 className="mt-1 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight">What the output looks like</h2>
          <p className="mt-2 text-center text-sm text-muted">Illustrative example — not real data.</p>
          <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
            <div className="border-b border-line px-6 py-4">
              <p className="font-semibold">Sprint Planning</p>
              <p className="text-xs text-muted">Oct 19, 2026 · 4 participants</p>
            </div>
            <div className="space-y-5 p-6 text-sm">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Executive summary</p>
                <p>The team planned the final sprint for the API and dashboard. Scope was frozen after Wednesday so the remaining time goes to the processing endpoint and bug fixes.</p>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"><Gavel className="size-3.5" /> Decision</p>
                <p>Scope is frozen after Wednesday; only bug fixes will be accepted.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left">
                  <thead className="text-xs text-muted"><tr><th className="py-2 pr-4 font-medium">Task</th><th className="pr-4 font-medium">Assigned to</th><th className="pr-4 font-medium">Due</th><th className="font-medium">Priority</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    <tr><td className="py-2.5 pr-4">Finish the processing endpoint</td><td className="pr-4">Rahul</td><td className="pr-4">Oct 21</td><td><Badge tone="bad">High</Badge></td></tr>
                    <tr><td className="py-2.5 pr-4">Investigate the date picker bug</td><td className="pr-4 text-muted">Not assigned</td><td className="pr-4 text-muted">No deadline</td><td><Badge tone="neutral">Low</Badge></td></tr>
                  </tbody>
                </table>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted"><AlertTriangle className="size-3.5" /> Unknown owners and deadlines stay blank instead of being guessed.</p>
            </div>
          </div>
        </section>

        <section className="px-4 pb-20">
          <div className="mx-auto max-w-4xl rounded-2xl bg-[#1e1b4b] p-10 text-center text-white sm:p-14" style={{ backgroundImage: 'radial-gradient(40rem 16rem at 80% 0%, #4338ca 0%, transparent 70%)' }}>
            <h2 className="text-3xl font-bold tracking-tight">Stop rewatching recordings.</h2>
            <p className="mx-auto mt-3 max-w-lg text-indigo-200">Get your next meeting’s minutes in the time it takes to make coffee.</p>
            <Link to={cta} className="mt-7 inline-block"><Button size="lg" variant="secondary" icon={ArrowRight}>Get started free</Button></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:flex-row">
          <Logo />
          <p>Transcripts are processed by your configured AI provider and stored privately in your account.</p>
        </div>
      </footer>
    </div>
  );
}
