import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import { PageLoader } from './components/ui.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

// Heavier, authenticated pages load on demand (recharts etc.).
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Meetings = lazy(() => import('./pages/Meetings.jsx'));
const CreateMeeting = lazy(() => import('./pages/CreateMeeting.jsx'));
const MeetingDetail = lazy(() => import('./pages/MeetingDetail.jsx'));
const ActionItems = lazy(() => import('./pages/ActionItems.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader label="Restoring your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
    <h1 className="text-4xl font-bold">404</h1>
    <p className="text-muted">That page doesn’t exist.</p>
    <a className="text-brand underline" href="/">Go home</a>
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/meetings" element={<Meetings />} />
            <Route path="/meetings/new" element={<CreateMeeting />} />
            <Route path="/meetings/:id" element={<MeetingDetail />} />
            <Route path="/action-items" element={<ActionItems />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
