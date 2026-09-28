/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Pipeline de Build da Extensão Chrome (Manifest V3).
 * Compila e empacota todos os artefatos estritamente em dist/extension/.
 */

import fs from 'fs';
import path from 'path';
import { build as esbuild } from 'esbuild';
import { build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';

const ROOT_DIR = process.cwd();
const EXT_SRC = path.resolve(ROOT_DIR, 'extension');
const DIST_EXT = path.resolve(ROOT_DIR, 'dist/extension');
const ASSETS_ICONS = path.resolve(ROOT_DIR, 'assets/icons');

async function cleanAndPrepare(): Promise<void> {
  if (fs.existsSync(DIST_EXT)) {
    fs.rmSync(DIST_EXT, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_EXT, { recursive: true });
  fs.mkdirSync(path.join(DIST_EXT, 'icons'), { recursive: true });
}

async function buildBackground(): Promise<void> {
  console.log('⚡ Compilando Background Service Worker...');
  await esbuild({
    entryPoints: [path.join(EXT_SRC, 'src/background/index.ts')],
    outfile: path.join(DIST_EXT, 'background.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    minify: false,
    sourcemap: false,
    alias: {
      '@shared': path.resolve(ROOT_DIR, 'shared'),
    },
  });
}

async function buildContentScript(): Promise<void> {
  console.log('⚡ Compilando Content Script...');
  await esbuild({
    entryPoints: [path.join(EXT_SRC, 'src/content/entrypoint.ts')],
    outfile: path.join(DIST_EXT, 'content.js'),
    bundle: true,
    format: 'iife',
    target: 'es2022',
    platform: 'browser',
    minify: false,
    sourcemap: false,
    loader: {
      '.css': 'text',
    },
    alias: {
      '@shared': path.resolve(ROOT_DIR, 'shared'),
    },
  });
}

async function buildPopupAndOptions(): Promise<void> {
  console.log('⚡ Compilando Popup e Options (React + Vite)...');
  
  // Build do Popup
  await viteBuild({
    root: path.join(EXT_SRC, 'src/popup'),
    base: '',
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': path.resolve(ROOT_DIR, 'shared'),
        '@': path.resolve(ROOT_DIR, 'extension/src'),
      },
    },
    build: {
      outDir: path.join(DIST_EXT, 'popup_temp'),
      emptyOutDir: true,
      rollupOptions: {
        input: path.join(EXT_SRC, 'src/popup/index.html'),
        output: {
          entryFileNames: 'popup.js',
          assetFileNames: 'popup.[ext]',
        },
      },
    },
  });

  // Mover popup.html e assets para a raiz de dist/extension
  const popupTemp = path.join(DIST_EXT, 'popup_temp');
  if (fs.existsSync(path.join(popupTemp, 'index.html'))) {
    fs.renameSync(path.join(popupTemp, 'index.html'), path.join(DIST_EXT, 'popup.html'));
  }
  if (fs.existsSync(path.join(popupTemp, 'popup.js'))) {
    fs.renameSync(path.join(popupTemp, 'popup.js'), path.join(DIST_EXT, 'popup.js'));
  }
  fs.rmSync(popupTemp, { recursive: true, force: true });

  // Build do Options
  await viteBuild({
    root: path.join(EXT_SRC, 'src/options'),
    base: '',
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': path.resolve(ROOT_DIR, 'shared'),
        '@': path.resolve(ROOT_DIR, 'extension/src'),
      },
    },
    build: {
      outDir: path.join(DIST_EXT, 'options_temp'),
      emptyOutDir: true,
      rollupOptions: {
        input: path.join(EXT_SRC, 'src/options/index.html'),
        output: {
          entryFileNames: 'options.js',
          assetFileNames: 'options.[ext]',
        },
      },
    },
  });

  const optionsTemp = path.join(DIST_EXT, 'options_temp');
  if (fs.existsSync(path.join(optionsTemp, 'index.html'))) {
    fs.renameSync(path.join(optionsTemp, 'index.html'), path.join(DIST_EXT, 'options.html'));
  }
  if (fs.existsSync(path.join(optionsTemp, 'options.js'))) {
    fs.renameSync(path.join(optionsTemp, 'options.js'), path.join(DIST_EXT, 'options.js'));
  }
  fs.rmSync(optionsTemp, { recursive: true, force: true });
}

async function copyAssets(): Promise<void> {
  console.log('⚡ Copiando Manifest, Estilos e Ícones...');
  
  // Copia manifest.json
  fs.copyFileSync(
    path.join(EXT_SRC, 'manifest.json'),
    path.join(DIST_EXT, 'manifest.json')
  );

  // Copia content.css
  fs.copyFileSync(
    path.join(EXT_SRC, 'src/content/styles/hud.css'),
    path.join(DIST_EXT, 'content.css')
  );

  // Copia ícones
  for (const size of [16, 48, 128]) {
    const iconName = `icon${size}.png`;
    const srcIcon = path.join(ASSETS_ICONS, iconName);
    const destIcon = path.join(DIST_EXT, 'icons', iconName);
    if (fs.existsSync(srcIcon)) {
      fs.copyFileSync(srcIcon, destIcon);
    }
  }
}

async function main(): Promise<void> {
  console.log('🚀 Iniciando Build Oficial da Extensão Chrome...');
  const start = Date.now();
  await cleanAndPrepare();
  await buildBackground();
  await buildContentScript();
  await buildPopupAndOptions();
  await copyAssets();
  console.log(`✅ Build da extensão concluído com sucesso em ${(Date.now() - start)}ms!`);
  console.log(`📁 Diretório gerado: ${DIST_EXT}`);
}

main().catch((err) => {
  console.error('❌ Falha no build da extensão:', err);
  process.exit(1);
});
