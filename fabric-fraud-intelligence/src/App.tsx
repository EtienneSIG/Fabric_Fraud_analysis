import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';

import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/AuthContext';
import { AppLayout } from '@/app/layout/AppLayout';
import { RoleProvider } from '@/app/RoleContext';
import { ROUTES } from '@/app/routes';
import '@/styles/theme.css';

function AuthGate() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <AuthPage />;
}

function Protected() {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return (
    <RoleProvider user={user?.email ?? 'analyst@demo'}>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </RoleProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthGate />} />
        <Route element={<Protected />}>
          {ROUTES.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
