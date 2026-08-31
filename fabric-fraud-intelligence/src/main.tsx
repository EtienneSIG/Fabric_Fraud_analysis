import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from '@/App';
import { AuthProvider } from '@/hooks/AuthContext';
import { ThemeProvider } from '@/hooks/ThemeContext';
import { bootstrapAuth } from '@/services/bootstrap';
import '@/i18n/i18n';

import './main.css';

const authService = bootstrapAuth();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 2, refetchOnWindowFocus: false },
    mutations: { retry: 1 },
  },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider authService={authService}>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);
