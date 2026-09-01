import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import { Suspense } from 'react';

import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/AuthContext';
import { AppLayout } from '@/app/layout/AppLayout';
import { PageLoader } from '@/app/components/PageLoader';
import { RoleProvider } from '@/app/RoleContext';
import { ToastProvider } from '@/app/toast/ToastProvider';
import { ROUTES } from '@/app/routes';
import '@/styles/theme.css';

function AuthGate() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <PageLoader />
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
      <div className="min-h-screen flex items-center justify-center">
        <PageLoader />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return (
    <RoleProvider user={user?.email ?? 'analyst@demo'}>
      <ToastProvider>
        <AppLayout>
          <Suspense fallback={<PageLoader bar />}>
            <Outlet />
          </Suspense>
        </AppLayout>
      </ToastProvider>
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
