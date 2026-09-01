import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { execSync } from 'node:child_process';
import { resolve } from 'path';
import { defineConfig } from 'vite';

function gitCommit(): string {
  try {
    return execSync('git rev-parse --short=6 HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Build stamp surfaced in Settings (deployment date + short commit).
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT__: JSON.stringify(gitCommit()),
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        msalRedirect: resolve(import.meta.dirname, 'msal-redirect.html'),
        popupRelay: resolve(import.meta.dirname, 'popup-relay.html'),
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
});
