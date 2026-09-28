/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Pipeline de Build do Web Studio para dist/web/.
 */

import path from 'path';
import { build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const ROOT_DIR = process.cwd();

async function main() {
  console.log('⚡ Compilando Web Studio (React + Tailwind)...');
  await viteBuild({
    root: ROOT_DIR,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(ROOT_DIR, '.'),
        '@shared': path.resolve(ROOT_DIR, 'shared'),
      },
    },
    build: {
      outDir: path.resolve(ROOT_DIR, 'dist/web'),
      emptyOutDir: true,
    },
  });
  console.log('✅ Web Studio compilado com sucesso em dist/web!');
}

main().catch((err) => {
  console.error('❌ Falha ao compilar Web Studio:', err);
  process.exit(1);
});
