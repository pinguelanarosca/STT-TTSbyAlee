/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cliente Direct REST para a API Gemini (Google AI Studio) na Extensão Chrome.
 * Utiliza fetch nativo com Whitelist Estrita, Fallback Imediato (Zero-Retry)
 * e Timeouts ajustados de 25s por modelo com AbortController.
 */

import { TtsSynthesisRequest, SttTranscriptionRequest } from '@shared/types/gemini';
import { DiscoveredModelInfo } from '@shared/types/models';
import {
  executeWithZeroRetryFallback,
  AUTH_TEST_INITIAL_MODEL,
  TTS_MODELS_WHITELIST,
  FLASH_LITE_MODELS_WHITELIST,
  STT_UNARY_MODELS_WHITELIST,
} from '@shared/constants/modelsCatalog';
import { base64ToUint8Array, pcmToWav, uint8ArrayToBase64 } from '@shared/utils/pcmWav';
import { logDiagnostic } from './diagnosticLogger';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_PER_MODEL_TIMEOUT_MS = 15000; // 15 segundos por modelo
const MAX_BASE64_AUDIO_LENGTH = 15 * 1024 * 1024; // 15MB limite de segurança

export class GeminiDirectClient {
  /**
   * Sintetiza fala com a cadeia estrita de fallback TTS (Zero-Retry).
   */
  public async synthesizeSpeech(
    request: TtsSynthesisRequest,
    apiKey: string,
    parentSignal?: AbortSignal
  ): Promise<{ audioBase64: string; mimeType: string; sampleRate: number; modelUsed: string }> {
    if (!apiKey) {
      throw new Error('Chave de API Gemini não informada.');
    }

    const { result, usedModelId } = await executeWithZeroRetryFallback(
      'tts',
      request.modelId,
      async (modelId) => {
        if (parentSignal?.aborted) {
          throw new Error('Operação TTS cancelada pelo usuário.');
        }

        const startTime = Date.now();
        await logDiagnostic({
          level: 'info',
          source: 'TTS',
          operation: 'MODEL_ATTEMPT',
          message: `Tentando modelo ${modelId}`,
          modelId,
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort(new Error(`Timeout de 15s excedido no modelo ${modelId}.`));
        }, MAX_PER_MODEL_TIMEOUT_MS);

        const onParentAbort = () => controller.abort(parentSignal?.reason);
        if (parentSignal) {
          parentSignal.addEventListener('abort', onParentAbort, { once: true });
        }

        try {
          const endpoint = `${GEMINI_BASE_URL}/models/${modelId}:generateContent?key=${apiKey}`;

          const payload = {
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: request.text,
                    speech_metadata: {
                      style: request.systemInstruction || 'Natural, clear speech with human breathing pauses',
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: request.voiceName || 'Puck',
                  },
                },
              },
            },
          };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          const durationMs = Date.now() - startTime;

          if (!response.ok) {
            const errorText = await response.text();
            await logDiagnostic({
              level: 'error',
              source: 'TTS',
              operation: 'MODEL_ERROR',
              modelId,
              httpStatus: response.status,
              durationMs,
              message: `Falha HTTP (${response.status}) no modelo ${modelId}: ${errorText}`,
              errorDetails: errorText,
            });
            throw new Error(`Falha HTTP (${response.status}) no modelo ${modelId}: ${errorText}`);
          }

          const data = await response.json();
          const candidatePart = data.candidates?.[0]?.content?.parts?.[0];

          if (!candidatePart?.inlineData?.data && !candidatePart?.inline_data?.data) {
            const msg = `Modelo ${modelId} não retornou dados de áudio na resposta.`;
            await logDiagnostic({
              level: 'warn',
              source: 'TTS',
              operation: 'MODEL_ERROR',
              modelId,
              durationMs,
              message: msg,
            });
            throw new Error(msg);
          }

          const rawBase64 = candidatePart.inlineData?.data || candidatePart.inline_data?.data;

          if (typeof rawBase64 !== 'string' || rawBase64.length === 0) {
            throw new Error(`Modelo ${modelId} retornou payload de áudio vazio.`);
          }

          if (rawBase64.length > MAX_BASE64_AUDIO_LENGTH) {
            throw new Error(`Áudio retornado (${Math.round(rawBase64.length / 1024 / 1024)}MB) excede o limite seguro de 15MB.`);
          }

          const rawBytes = base64ToUint8Array(rawBase64);
          let finalBase64 = rawBase64;

          const isRiffWav = rawBytes.length > 4 && rawBytes[0] === 0x52 && rawBytes[1] === 0x49 && rawBytes[2] === 0x46 && rawBytes[3] === 0x46;
          if (!isRiffWav) {
            const cleanWav = pcmToWav(rawBytes, 24000, 1, 16);
            finalBase64 = uint8ArrayToBase64(cleanWav);
          }

          await logDiagnostic({
            level: 'info',
            source: 'TTS',
            operation: 'MODEL_SUCCESS',
            message: `Modelo ${modelId} respondeu áudio com sucesso`,
            modelId,
            durationMs,
          });

          return {
            audioBase64: finalBase64,
            mimeType: 'audio/wav',
            sampleRate: 24000,
          };
        } catch (err: any) {
          const durationMs = Date.now() - startTime;
          const errMsg = err instanceof Error ? err.message : String(err);
          await logDiagnostic({
            level: 'error',
            source: 'TTS',
            operation: 'MODEL_ERROR',
            modelId,
            durationMs,
            message: errMsg,
            errorDetails: err?.stack || String(err),
          });
          throw err;
        } finally {
          clearTimeout(timeoutId);
          if (parentSignal) {
            parentSignal.removeEventListener('abort', onParentAbort);
          }
        }
      }
    );

    return {
      ...result,
      modelUsed: usedModelId,
    };
  }

  /**
   * Transcreve áudio gravado via protocolo STT Unary.
   */
  public async transcribeAudio(
    request: SttTranscriptionRequest,
    apiKey: string,
    parentSignal?: AbortSignal
  ): Promise<string> {
    if (!apiKey) {
      throw new Error('Chave de API Gemini não informada.');
    }

    const promptText = request.formattingInstruction
      ? `Transcreva o seguinte áudio respeitando estritamente esta instrução: ${request.formattingInstruction}`
      : 'Transcreva o áudio com pontuação e ortografia correta, sem adicionar introduções ou conclusões.';

    const rawMime = request.mimeType || 'audio/webm';
    const normalizedMime = rawMime.split(';')[0].trim() || 'audio/webm';

    const { result } = await executeWithZeroRetryFallback(
      'stt_unary',
      request.modelId,
      async (modelId) => {
        if (parentSignal?.aborted) {
          throw new Error('Operação STT cancelada.');
        }

        const startTime = Date.now();
        await logDiagnostic({
          level: 'info',
          source: 'STT',
          operation: 'MODEL_ATTEMPT',
          message: `Tentando modelo ${modelId} com mimeType: ${normalizedMime}`,
          modelId,
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort(new Error(`Timeout de 15s excedido no modelo ${modelId}.`));
        }, MAX_PER_MODEL_TIMEOUT_MS);

        try {
          const endpoint = `${GEMINI_BASE_URL}/models/${modelId}:generateContent?key=${apiKey}`;

          const payload = {
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inline_data: {
                      mime_type: normalizedMime,
                      data: request.audioBase64,
                    },
                  },
                  {
                    text: promptText,
                  },
                ],
              },
            ],
          };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          const durationMs = Date.now() - startTime;

          if (!response.ok) {
            const errorText = await response.text();
            await logDiagnostic({
              level: 'error',
              source: 'STT',
              operation: 'MODEL_ERROR',
              modelId,
              httpStatus: response.status,
              durationMs,
              message: `Falha HTTP (${response.status}) no modelo ${modelId}: ${errorText}`,
              errorDetails: errorText,
            });
            throw new Error(`Falha HTTP (${response.status}) no modelo ${modelId}: ${errorText}`);
          }

          const data = await response.json();
          const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!textOutput) {
            const msg = `Modelo ${modelId} não retornou transcrição.`;
            await logDiagnostic({
              level: 'warn',
              source: 'STT',
              operation: 'MODEL_ERROR',
              modelId,
              durationMs,
              message: msg,
            });
            throw new Error(msg);
          }

          await logDiagnostic({
            level: 'info',
            source: 'STT',
            operation: 'MODEL_SUCCESS',
            message: `Modelo ${modelId} transcreveu com sucesso`,
            modelId,
            durationMs,
          });

          return textOutput.trim();
        } catch (err: any) {
          const durationMs = Date.now() - startTime;
          const errMsg = err instanceof Error ? err.message : String(err);
          await logDiagnostic({
            level: 'error',
            source: 'STT',
            operation: 'MODEL_ERROR',
            modelId,
            durationMs,
            message: errMsg,
            errorDetails: err?.stack || String(err),
          });
          throw err;
        } finally {
          clearTimeout(timeoutId);
        }
      }
    );

    return result;
  }

  /**
   * Inspeciona conteúdo visual com a whitelist Vision/Geral.
   */
  public async inspectVisionContext(
    imageBase64: string,
    instruction: string,
    apiKey: string,
    modelId?: string
  ): Promise<string> {
    if (!apiKey) {
      throw new Error('Chave de API Gemini não informada.');
    }

    const { result } = await executeWithZeroRetryFallback(
      'vision',
      modelId,
      async (targetModel) => {
        const startTime = Date.now();
        await logDiagnostic({
          level: 'info',
          source: 'LENS',
          operation: 'MODEL_ATTEMPT',
          message: `Tentando análise com modelo ${targetModel}`,
          modelId: targetModel,
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort(new Error(`Timeout de 15s excedido no modelo ${targetModel}.`));
        }, MAX_PER_MODEL_TIMEOUT_MS);

        try {
          const endpoint = `${GEMINI_BASE_URL}/models/${targetModel}:generateContent?key=${apiKey}`;

          const payload = {
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: imageBase64,
                    },
                  },
                  {
                    text: instruction || 'Extraia e transcreva com exatidão todo o texto visível nesta área selecionada da página. Retorne unicamente o texto extraído, limpo, sem introduções ou observações, pronto para ser lido.',
                  },
                ],
              },
            ],
          };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          const durationMs = Date.now() - startTime;

          if (!response.ok) {
            const errorText = await response.text();
            await logDiagnostic({
              level: 'error',
              source: 'LENS',
              operation: 'MODEL_ERROR',
              modelId: targetModel,
              httpStatus: response.status,
              durationMs,
              message: `Falha HTTP (${response.status}) no modelo ${targetModel}: ${errorText}`,
              errorDetails: errorText,
            });
            throw new Error(`Falha HTTP (${response.status}) no modelo ${targetModel}: ${errorText}`);
          }

          const data = await response.json();
          const description = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

          await logDiagnostic({
            level: 'info',
            source: 'LENS',
            operation: 'MODEL_SUCCESS',
            message: `Modelo ${targetModel} analisou com sucesso`,
            modelId: targetModel,
            durationMs,
          });

          return description.trim();
        } catch (err: any) {
          const durationMs = Date.now() - startTime;
          const errMsg = err instanceof Error ? err.message : String(err);
          await logDiagnostic({
            level: 'error',
            source: 'LENS',
            operation: 'MODEL_ERROR',
            modelId: targetModel,
            durationMs,
            message: errMsg,
            errorDetails: err?.stack || String(err),
          });
          throw err;
        } finally {
          clearTimeout(timeoutId);
        }
      }
    );

    return result;
  }

  public async testApiKey(apiKey: string): Promise<boolean> {
    try {
      await executeWithZeroRetryFallback(
        'auth_test',
        AUTH_TEST_INITIAL_MODEL,
        async (modelId) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          try {
            const endpoint = `${GEMINI_BASE_URL}/models/${modelId}?key=${apiKey}`;
            const response = await fetch(endpoint, { method: 'GET', signal: controller.signal });
            if (!response.ok) {
              throw new Error(`Chave recusada no modelo ${modelId} (${response.status})`);
            }
            return true;
          } finally {
            clearTimeout(timeoutId);
          }
        }
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  public async discoverAvailableModels(apiKey: string): Promise<DiscoveredModelInfo[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const endpoint = `${GEMINI_BASE_URL}/models?key=${apiKey}`;
      const response = await fetch(endpoint, { method: 'GET', signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Erro ao listar modelos: ${response.statusText}`);
      }
      const data = await response.json();
      const modelsList = data.models || [];

      const allowedIds = new Set<string>([
        ...TTS_MODELS_WHITELIST,
        ...FLASH_LITE_MODELS_WHITELIST,
        ...STT_UNARY_MODELS_WHITELIST,
      ]);

      return modelsList
        .map((m: Record<string, unknown>) => ({
          id: String(m.name || '').replace(/^models\//, ''),
          displayName: String(m.displayName || ''),
          description: String(m.description || ''),
          supportedGenerationMethods: Array.isArray(m.supportedGenerationMethods)
            ? (m.supportedGenerationMethods as string[])
            : [],
          discoveredAt: Date.now(),
        }))
        .filter((m: DiscoveredModelInfo) => allowedIds.has(m.id));
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const geminiDirectClient = new GeminiDirectClient();
