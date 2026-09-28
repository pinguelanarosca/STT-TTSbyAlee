/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cliente Direct REST para a API Gemini (Google AI Studio) na Extensão Chrome.
 * Utiliza fetch nativo com Whitelist Estrita, Fallback Imediato (Zero-Retry)
 * e Timeouts reais de até 15s por modelo com AbortController.
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

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_PER_MODEL_TIMEOUT_MS = 15000; // 15 segundos máximo por modelo
const MAX_BASE64_AUDIO_LENGTH = 15 * 1024 * 1024; // 15MB limite de segurança

export class GeminiDirectClient {
  /**
   * Sintetiza fala com a cadeia estrita de fallback TTS (Zero-Retry).
   * Ordem: gemini-3.8-flash-lite-tts -> gemini-3.8-flash-tts -> gemini-3.1-flash-tts-preview -> gemini-2.5-flash-preview-tts
   * Cada tentativa possui timeout rígido de 15s e suporte a cancelamento.
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

        console.log(`[TTS Client] Tentando síntese com o modelo: ${modelId}`);

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

          // Formato REST oficial Gemini para TTS com speech_metadata
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

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[TTS Client] Falha HTTP (${response.status}) no modelo ${modelId}:`, errorText);
            throw new Error(`Falha HTTP (${response.status}) no modelo ${modelId}: ${errorText}`);
          }

          const data = await response.json();
          const candidatePart = data.candidates?.[0]?.content?.parts?.[0];

          if (!candidatePart?.inlineData?.data && !candidatePart?.inline_data?.data) {
            console.warn(`[TTS Client] Modelo ${modelId} não retornou dados de áudio.`);
            throw new Error(`Modelo ${modelId} não retornou dados de áudio na resposta.`);
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

          // Se o áudio retornado já contiver cabeçalho RIFF WAV, preserva diretamente sem reprocessamento pesado
          const isRiffWav = rawBytes.length > 4 && rawBytes[0] === 0x52 && rawBytes[1] === 0x49 && rawBytes[2] === 0x46 && rawBytes[3] === 0x46;
          if (!isRiffWav) {
            // Se for PCM Linear puro sem container RIFF, empacota com cabeçalho WAV canônico 24kHz
            const cleanWav = pcmToWav(rawBytes, 24000, 1, 16);
            finalBase64 = uint8ArrayToBase64(cleanWav);
          }

          console.log(`[TTS Client] Síntese concluída com sucesso via modelo: ${modelId}`);

          return {
            audioBase64: finalBase64,
            mimeType: 'audio/wav',
            sampleRate: 24000,
          };
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
   * Transcreve áudio gravado via protocolo STT Unary (gemini-3.5-flash-lite -> gemini-3.1-flash-lite) com Zero-Retry Fallback.
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

    // Normaliza estritamente o mimeType removendo parâmetros como ;codecs=opus que causam HTTP 400
    const rawMime = request.mimeType || 'audio/webm';
    const normalizedMime = rawMime.split(';')[0].trim() || 'audio/webm';

    const { result } = await executeWithZeroRetryFallback(
      'stt_unary',
      request.modelId,
      async (modelId) => {
        if (parentSignal?.aborted) {
          throw new Error('Operação STT cancelada.');
        }

        console.log(`[STT Client] Tentando transcrição com o modelo: ${modelId}, mimeType normalizado: ${normalizedMime}`);

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

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[STT Client] Falha HTTP (${response.status}) no modelo ${modelId}:`, errorText);
            throw new Error(`Falha HTTP (${response.status}) no modelo ${modelId}: ${errorText}`);
          }

          const data = await response.json();
          const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!textOutput) {
            throw new Error(`Modelo ${modelId} não retornou transcrição.`);
          }

          console.log(`[STT Client] Transcrição concluída com sucesso via modelo: ${modelId}`);
          return textOutput.trim();
        } finally {
          clearTimeout(timeoutId);
        }
      }
    );

    return result;
  }

  /**
   * Inspeciona conteúdo visual com a whitelist Vision/Geral (gemini-3.5-flash-lite -> gemini-3.1-flash-lite).
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
        console.log(`[Vision Client] Tentando análise visual com o modelo: ${targetModel}`);

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
                    text: instruction || 'Analise a imagem da tela e descreva detalhadamente os elementos e textos visíveis.',
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

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Vision Client] Falha HTTP (${response.status}) no modelo ${targetModel}:`, errorText);
            throw new Error(`Falha HTTP (${response.status}) no modelo ${targetModel}: ${errorText}`);
          }

          const data = await response.json();
          const description = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          console.log(`[Vision Client] Análise visual concluída com sucesso via modelo: ${targetModel}`);
          return description.trim();
        } finally {
          clearTimeout(timeoutId);
        }
      }
    );

    return result;
  }

  /**
   * Testa a validade da chave de API utilizando a cadeia Auth (gemini-3.1-flash-lite -> gemini-3.5-flash-lite).
   */
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

  /**
   * Realiza descoberta de modelos na API, filtrando estritamente para a whitelist permitida.
   */
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
