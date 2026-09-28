/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Rotas de Distribuição e Inspeção da Extensão Chrome no Servidor.
 * - GET /api/extension/files (Lista metadados dos arquivos reais de dist/extension)
 * - GET /api/extension/download (Download do pacote ZIP real compilado)
 * - GET /api/extension/file/* (Visualização de arquivo individual)
 */

import { Router, Request, Response } from 'express';
import { extensionPacker } from '../services/extensionPacker';

export const extensionPackageRouter = Router();

// GET /api/extension/files - Lista arquivos reais da extensão
extensionPackageRouter.get('/extension/files', (_req: Request, res: Response) => {
  try {
    const files = extensionPacker.getExtensionFiles();
    return res.json({ success: true, data: files });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API /extension/files]', msg);
    return res.status(500).json({ success: false, error: msg });
  }
});

// GET /api/extension/download - Baixa o pacote ZIP compilado
extensionPackageRouter.get('/extension/download', (_req: Request, res: Response) => {
  try {
    const zipPath = extensionPacker.generateOrGetZip();
    return res.download(zipPath, 'extensao-extttsstt.zip', (err) => {
      if (err) {
        console.error('[API /extension/download] Erro no download:', err);
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API /extension/download]', msg);
    return res.status(500).json({ success: false, error: msg });
  }
});

// GET /api/extension/file/* - Retorna arquivo individual da extensão
extensionPackageRouter.get('/extension/file/*', (req: Request, res: Response) => {
  try {
    const relativePath = req.params[0];
    if (!relativePath) {
      return res.status(400).send('Caminho não especificado');
    }

    const file = extensionPacker.getSingleFile(relativePath);
    if (!file) {
      return res.status(404).send('Arquivo não encontrado no build da extensão');
    }

    res.setHeader('Content-Type', file.mimeType);
    return res.send(file.buffer);
  } catch (err) {
    return res.status(500).send(String(err));
  }
});
