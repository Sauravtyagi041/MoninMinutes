import Logo from '../components/Logo.jsx';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-[#0a0f1f] p-12 text-white lg:flex" style={{ backgroundImage: 'radial-gradient(60rem 30rem at 0% 0%, #312e81 0%, transparent 60%)' }}>
        <Logo />
        <div className="space-y-4">
          <p className="text-3xl font-semibold leading-tight">Turn conversations into clarity.</p>
          <p className="max-w-md text-slate-300">Paste a transcript. Get a summary, decisions, and action items with owners and deadlines — only what was actually said.</p>
        </div>
        <p className="text-xs text-slate-400">Transcripts are private to your account.</p>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden"><Logo /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          </div>
          {children}
          <p className="text-center text-sm text-muted">{footer}</p>
        </div>
      </div>
    </div>
  );
}
