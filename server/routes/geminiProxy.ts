/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Rotas de proxy Gemini no Servidor Express.
 * Mantém total equivalência com os endpoints existentes:
 * - POST /api/tts
 * - POST /api/stt
 * - POST /api/vision
 * - POST /api/test-key
 */

import { Router, Request, Response } from 'express';
import { geminiServerClient } from '../services/geminiServerClient';
import { TtsSynthesisRequest, SttTranscriptionRequest } from '@shared/types/gemini';

export const geminiProxyRouter = Router();

function extractApiKey(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.body && typeof req.body.apiKey === 'string') {
    return req.body.apiKey.trim();
  }
  return undefined;
}

// POST /api/tts - Síntese de fala
geminiProxyRouter.post('/tts', async (req: Request, res: Response) => {
  try {
    const apiKey = extractApiKey(req);
    const payload = req.body as TtsSynthesisRequest;

    if (!payload.text) {
      return res.status(400).json({ success: false, error: 'O campo text é obrigatório.' });
    }

    const result = await geminiServerClient.synthesizeSpeech(payload, apiKey);
    return res.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API /tts]', msg);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST /api/stt - Transcrição de áudio
geminiProxyRouter.post('/stt', async (req: Request, res: Response) => {
  try {
    const apiKey = extractApiKey(req);
    const payload = req.body as SttTranscriptionRequest;

    if (!payload.audioBase64) {
      return res.status(400).json({ success: false, error: 'O campo audioBase64 é obrigatório.' });
    }

    const text = await geminiServerClient.transcribeAudio(payload, apiKey);
    return res.json({ success: true, data: { text } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API /stt]', msg);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST /api/vision - Inspeção multimodal
geminiProxyRouter.post('/vision', async (req: Request, res: Response) => {
  try {
    const apiKey = extractApiKey(req);
    const { imageBase64, query, modelId } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'O campo imageBase64 é obrigatório.' });
    }

    const description = await geminiServerClient.analyzeVision(imageBase64, query, apiKey, modelId);
    return res.json({ success: true, data: { description } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API /vision]', msg);
    return res.status(500).json({ success: false, error: msg });
  }
});

// POST /api/test-key - Verificação de chave
geminiProxyRouter.post('/test-key', async (req: Request, res: Response) => {
  try {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'Nenhuma chave fornecida.' });
    }
    await geminiServerClient.discoverModels(apiKey);
    return res.json({ success: true, message: 'Chave autenticada com sucesso!' });
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Chave inválida ou não autorizada.' });
  }
});
