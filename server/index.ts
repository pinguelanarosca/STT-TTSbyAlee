/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Servidor Express Full-Stack para EXT TTS STT Studio.
 * - Fornece rotas de API seguras para síntese TTS, transcrição STT e visão
 * - Distribui os artefatos compilados da extensão Chrome
 * - Monta o Vite dev server em desenvolvimento e serve dist/web em produção
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { geminiProxyRouter } from './routes/geminiProxy';
import { modelsDiscoveryRouter } from './routes/modelsDiscovery';
import { extensionPackageRouter } from './routes/extensionPackage';

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();

  // Parsing com limite para suportar áudio e imagens base64
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Rotas da API
  app.use('/api', geminiProxyRouter);
  app.use('/api', modelsDiscoveryRouter);
  app.use('/api', extensionPackageRouter);

  // Frontend: Vite em Dev vs Static em Produção
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distWeb = path.resolve(process.cwd(), 'dist/web');
    if (fs.existsSync(distWeb)) {
      app.use(express.static(distWeb));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distWeb, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
