import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Live Openverse search, proxied.
      //
      // The admin page runs in a browser, and a browser will not read a cross-origin
      // response unless the far end returns CORS headers naming this origin.
      // api.openverse.org is a plain public API, not one built for direct browser use,
      // so a page-side `fetch` to it fails with an opaque "Failed to fetch" before any
      // result is parsed. Proxying through the dev server makes the request same-origin
      // from the browser's point of view — the hop to Openverse happens in Node, where
      // CORS does not apply.
      //
      // This is a dev-server facility. A production build has no proxy, so the endpoint
      // falls back to the absolute URL (see `searchEndpoint()` in openverse.ts) and a
      // real deployment needs its own server-side route.
      '/openverse': {
        target: 'https://api.openverse.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openverse/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
