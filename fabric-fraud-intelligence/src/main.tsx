import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from '@/App';
import { initTelemetry } from '@/backend/telemetry';
import { AuthProvider } from '@/hooks/AuthContext';
import { ThemeProvider } from '@/hooks/ThemeContext';
import { bootstrapAuth } from '@/services/bootstrap';
import { handleFoundryRedirect } from '@/services/FoundryAgentClient';
import '@/i18n/i18n';

import './main.css';

initTelemetry();
const authService = bootstrapAuth();
// Warm the Foundry MSAL app + process any returning redirect sign-in before the first agent call.
void handleFoundryRedirect();

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
