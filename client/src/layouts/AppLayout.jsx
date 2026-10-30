import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckSquare, FileText, LayoutDashboard, LogOut, Menu, Moon, PlusCircle, Settings, Sun, X } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/meetings', label: 'All Meetings', icon: FileText, end: true },
  { to: '/meetings/new', label: 'Create Meeting', icon: PlusCircle },
  { to: '/action-items', label: 'Action Items', icon: CheckSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onLogout = async () => {
    try {
      await logout();
    } catch {
      /* cookie is cleared client-side regardless */
    }
    toast.success('Signed out');
    navigate('/login');
  };

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2 pt-1"><Logo to="/dashboard" /></div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink'
              }`
            }
          >
            <Icon className="size-4" aria-hidden /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-line pt-4">
        <div className="px-2">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} className="flex h-9 flex-1 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-2 hover:text-ink cursor-pointer">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button onClick={onLogout} className="flex h-9 flex-[2] items-center justify-center gap-2 rounded-lg border border-line text-sm text-muted hover:bg-surface-2 hover:text-ink cursor-pointer">
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Logo to="/dashboard" />
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-md p-2 text-muted hover:bg-surface-2 cursor-pointer">
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-surface shadow-xl">
            <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-md p-1 text-muted cursor-pointer"><X className="size-5" /></button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
    </div>
  );
}
