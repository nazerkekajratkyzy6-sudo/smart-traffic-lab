import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Сборкадан кейін барлық /assets файлдарын service worker алдын ала кэшіне қосады (толық офлайн). */
function precacheAssets() {
  return {
    name: 'stl-precache',
    apply: 'build' as const,
    closeBundle() {
      const dist = join(process.cwd(), 'dist');
      const sw = join(dist, 'sw.js');
      if (!existsSync(sw)) return;
      const assets = readdirSync(join(dist, 'assets')).map((f) => `/assets/${f}`);
      const src = readFileSync(sw, 'utf8').replace(/const CORE = \[([^\]]*)\];/, (_m, inner) => `const CORE = [${inner}, ${assets.map((a) => JSON.stringify(a)).join(', ')}];`);
      writeFileSync(sw, src.replace("const CACHE = 'stl-v1';", `const CACHE = 'stl-${Date.now().toString(36)}';`));
    },
  };
}

export default defineConfig({
  base: process.env.VITE_ARTIFACT === '1' ? './' : '/',
  plugins: [react(), precacheAssets()],
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          pdf: ['jspdf', 'qrcode'],
        },
      },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as never);
