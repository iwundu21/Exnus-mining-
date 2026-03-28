import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      nodePolyfills({
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
      react(), 
      tailwindcss(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'cross-fetch': path.resolve(__dirname, 'src/lib/fetch-shim.ts'),
        'node-fetch': path.resolve(__dirname, 'src/lib/fetch-shim.ts'),
        'isomorphic-fetch': path.resolve(__dirname, 'src/lib/fetch-shim.ts'),
        'whatwg-fetch': path.resolve(__dirname, 'src/lib/fetch-shim.ts'),
        'unfetch': path.resolve(__dirname, 'src/lib/fetch-shim.ts'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
