/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Rotas de Descoberta e Catálogo de Modelos no Servidor Express.
 * - GET /api/models (Descoberta dinâmica na API com cache em memória)
 * - GET /api/models/known (Catálogo canônico e metadados oficiais)
 */

import { Router, Request, Response } from 'express';
import { geminiServerClient } from '../services/geminiServerClient';
import { KNOWN_MODELS, TASK_FALLBACK_CHAINS } from '@shared/constants/modelsCatalog';
import { DiscoveredModelInfo } from '@shared/types/models';

export const modelsDiscoveryRouter = Router();

// Cache em memória de modelos descobertos (TTL: 5 minutos)
let cachedModels: DiscoveredModelInfo[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// GET /api/models - Lista modelos descobertos da API Gemini
modelsDiscoveryRouter.get('/models', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;

    const now = Date.now();
    if (!apiKey && cachedModels.length > 0 && (now - cacheTimestamp) < CACHE_TTL_MS) {
      return res.json({ success: true, data: cachedModels, cached: true });
    }

    const discovered = await geminiServerClient.discoverModels(apiKey);
    if (!apiKey) {
      cachedModels = discovered;
      cacheTimestamp = now;
    }

    return res.json({ success: true, data: discovered, cached: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[API /models] Falha na descoberta, retornando conhecidos:', msg);
    // Fallback: retorna os modelos conhecidos como descobertos
    const fallbackList = Object.values(KNOWN_MODELS).map((m) => ({
      id: m.id,
      displayName: m.displayName,
      description: m.description,
      supportedGenerationMethods: m.apiMethods,
      discoveredAt: Date.now(),
    }));
    return res.json({ success: true, data: fallbackList, fallback: true });
  }
});

// GET /api/models/known - Retorna o catálogo oficial estático com capacidades e fallbacks
modelsDiscoveryRouter.get('/models/known', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      knownModels: KNOWN_MODELS,
      fallbackChains: TASK_FALLBACK_CHAINS,
    },
  });
});
