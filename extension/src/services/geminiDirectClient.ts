/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cliente Direct REST para a API Gemini (Google AI Studio) na Extensão Chrome.
 * Utiliza fetch nativo com Whitelist Estrita e Fallback Imediato (Zero-Retry).
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

export class GeminiDirectClient {
  /**
   * Sintetiza fala com a cadeia estrita de fallback TTS (Zero-Retry).
   * Ordem: gemini-3.8-flash-lite-tts -> gemini-3.8-flash-tts -> gemini-3.1-flash-tts-preview -> gemini-2.5-flash-preview-tts
   */
  public async synthesizeSpeech(
    request: TtsSynthesisRequest,
    apiKey: string
  ): Promise<{ audioBase64: string; mimeType: string; sampleRate: number; modelUsed: string }> {
    const { result, usedModelId } = await executeWithZeroRetryFallback(
      'tts',
      request.modelId,
      async (modelId) => {
        const endpoint = `${GEMINI_BASE_URL}/models/${modelId}:generateContent?key=${apiKey}`;

        const payload = {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: request.text,
                  speechMetadata: {
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
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Falha HTTP (${response.status}) no modelo ${modelId}: ${errorText}`);
        }

        const data = await response.json();
        const candidatePart = data.candidates?.[0]?.content?.parts?.[0];

        if (!candidatePart?.inlineData?.data) {
          throw new Error(`Modelo ${modelId} não retornou dados de áudio na resposta.`);
        }

        const rawBase64 = candidatePart.inlineData.data;
        const rawBytes = base64ToUint8Array(rawBase64);
        let finalBase64 = rawBase64;

        // Se o áudio for PCM Linear puro sem cabeçalho RIFF, encapsula em WAV 24kHz
        const isWav = rawBytes.length > 4 && rawBytes[0] === 0x52 && rawBytes[1] === 0x49 && rawBytes[2] === 0x46 && rawBytes[3] === 0x46;
        if (!isWav) {
          const wavBytes = pcmToWav(rawBytes, 24000, 1, 16);
          finalBase64 = uint8ArrayToBase64(wavBytes);
        }

        return {
          audioBase64: finalBase64,
          mimeType: 'audio/wav',
          sampleRate: 24000,
        };
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
    apiKey: string
  ): Promise<string> {
    const promptText = request.formattingInstruction
      ? `Transcreva o seguinte áudio respeitando estritamente esta instrução: ${request.formattingInstruction}`
      : 'Transcreva o áudio com pontuação e ortografia correta, sem adicionar introduções ou conclusões.';

    const { result } = await executeWithZeroRetryFallback(
      'stt_unary',
      request.modelId,
      async (modelId) => {
        const endpoint = `${GEMINI_BASE_URL}/models/${modelId}:generateContent?key=${apiKey}`;

        const payload = {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: request.mimeType || 'audio/wav',
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
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Falha HTTP (${response.status}) no modelo ${modelId}: ${errorText}`);
        }

        const data = await response.json();
        const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textOutput) {
          throw new Error(`Modelo ${modelId} não retornou transcrição.`);
        }

        return textOutput.trim();
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
    const { result } = await executeWithZeroRetryFallback(
      'vision',
      modelId,
      async (targetModel) => {
        const endpoint = `${GEMINI_BASE_URL}/models/${targetModel}:generateContent?key=${apiKey}`;

        const payload = {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
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
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Falha HTTP (${response.status}) no modelo ${targetModel}: ${errorText}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
          const endpoint = `${GEMINI_BASE_URL}/models/${modelId}?key=${apiKey}`;
          const response = await fetch(endpoint, { method: 'GET' });
          if (!response.ok) {
            throw new Error(`Chave recusada no modelo ${modelId} (${response.status})`);
          }
          return true;
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
    const endpoint = `${GEMINI_BASE_URL}/models?key=${apiKey}`;
    const response = await fetch(endpoint, { method: 'GET' });
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
  }
}

export const geminiDirectClient = new GeminiDirectClient();
