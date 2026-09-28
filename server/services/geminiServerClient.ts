/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Implementação Node.js do Cliente Gemini com Whitelist Estrita
 * e Motor de Fallback Imediato (Zero-Retry).
 */

import { GoogleGenAI } from '@google/genai';
import { TtsSynthesisRequest, SttTranscriptionRequest } from '@shared/types/gemini';
import { DiscoveredModelInfo } from '@shared/types/models';
import {
  executeWithZeroRetryFallback,
  AUTH_TEST_INITIAL_MODEL,
  TTS_MODELS_WHITELIST,
  FLASH_LITE_MODELS_WHITELIST,
  STT_UNARY_MODELS_WHITELIST,
} from '@shared/constants/modelsCatalog';
import { base64ToUint8Array, pcmToWav, uint8ArrayToBase64, wavToPcm } from '@shared/utils/pcmWav';

export class GeminiServerClient {
  private getClient(overrideApiKey?: string): GoogleGenAI {
    const key = overrideApiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('Chave de API Gemini não configurada no servidor (GEMINI_API_KEY).');
    }
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  /**
   * Síntese de fala utilizando a cadeia estrita de fallback TTS (Zero-Retry).
   * Ordem: gemini-3.8-flash-lite-tts -> gemini-3.8-flash-tts -> gemini-3.1-flash-tts-preview -> gemini-2.5-flash-preview-tts
   */
  public async synthesizeSpeech(
    request: TtsSynthesisRequest,
    overrideApiKey?: string
  ): Promise<{ audioBase64: string; mimeType: string; sampleRate: number; modelUsed: string }> {
    const ai = this.getClient(overrideApiKey);
    const voiceName = request.voiceName || 'Puck';
    const systemPrompt = request.systemInstruction || 'Natural, clear speech with human breathing pauses';

    const { result, usedModelId } = await executeWithZeroRetryFallback(
      'tts',
      request.modelId,
      async (modelId) => {
        const response = await ai.models.generateContent({
          model: modelId,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: request.text,
                  // @ts-ignore - speechMetadata suportado pela API Gemini TTS
                  speechMetadata: {
                    style: systemPrompt,
                  },
                },
              ],
            },
          ],
          config: {
            // @ts-ignore
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
          },
        });

        const candidatePart = response.candidates?.[0]?.content?.parts?.[0];
        if (!candidatePart?.inlineData?.data) {
          throw new Error(`Modelo "${modelId}" não retornou dados de áudio.`);
        }

        const rawBase64 = candidatePart.inlineData.data;
        const rawBytes = base64ToUint8Array(rawBase64);
        let finalBase64 = rawBase64;

        try {
          const isWav = rawBytes.length > 4 && rawBytes[0] === 0x52 && rawBytes[1] === 0x49 && rawBytes[2] === 0x46 && rawBytes[3] === 0x46;
          if (isWav) {
            const { pcmData, metadata } = wavToPcm(rawBytes);
            const cleanWav = pcmToWav(pcmData, metadata.sampleRate || 24000, metadata.channels || 1, metadata.bitDepth || 16);
            finalBase64 = uint8ArrayToBase64(cleanWav);
          } else {
            const cleanWav = pcmToWav(rawBytes, 24000, 1, 16);
            finalBase64 = uint8ArrayToBase64(cleanWav);
          }
        } catch (cleanErr) {
          console.warn('[GeminiServerClient] Fallback de limpeza WAV:', cleanErr);
          const cleanWav = pcmToWav(rawBytes, 24000, 1, 16);
          finalBase64 = uint8ArrayToBase64(cleanWav);
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
   * Transcrição de áudio via protocolo STT Unary (gemini-3.5-flash-lite -> gemini-3.1-flash-lite).
   */
  public async transcribeAudio(
    request: SttTranscriptionRequest,
    overrideApiKey?: string
  ): Promise<string> {
    const ai = this.getClient(overrideApiKey);
    const instruction = request.formattingInstruction || 'Transcreva com precisão ortográfica e pontuação correta.';

    const { result } = await executeWithZeroRetryFallback(
      'stt_unary',
      request.modelId,
      async (modelId) => {
        const response = await ai.models.generateContent({
          model: modelId,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: request.mimeType || 'audio/wav',
                  data: request.audioBase64,
                },
              },
              {
                text: `Transcreva o áudio respeitando estritamente: ${instruction}`,
              },
            ],
          },
        });

        const text = response.text || '';
        if (!text) {
          throw new Error(`Modelo "${modelId}" não retornou texto transcrito.`);
        }
        return text.trim();
      }
    );

    return result;
  }

  /**
   * Análise visual multimodal com a whitelist Vision/Geral (gemini-3.5-flash-lite -> gemini-3.1-flash-lite).
   */
  public async analyzeVision(
    imageBase64: string,
    query: string,
    overrideApiKey?: string,
    modelId?: string
  ): Promise<string> {
    const ai = this.getClient(overrideApiKey);

    const { result } = await executeWithZeroRetryFallback(
      'vision',
      modelId,
      async (targetModel) => {
        const response = await ai.models.generateContent({
          model: targetModel,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageBase64,
                },
              },
              {
                text: query || 'Descreva detalhadamente o conteúdo visual desta imagem.',
              },
            ],
          },
        });

        const text = response.text || '';
        if (!text) {
          throw new Error(`Modelo "${targetModel}" não retornou descrição visual.`);
        }
        return text.trim();
      }
    );

    return result;
  }

  /**
   * Validação de chave de API utilizando a cadeia Auth (gemini-3.1-flash-lite -> gemini-3.5-flash-lite).
   */
  public async testApiKey(overrideApiKey: string): Promise<boolean> {
    const ai = this.getClient(overrideApiKey);

    try {
      await executeWithZeroRetryFallback(
        'auth_test',
        AUTH_TEST_INITIAL_MODEL,
        async (modelId) => {
          const response = await ai.models.generateContent({
            model: modelId,
            contents: 'ping',
          });
          if (!response) {
            throw new Error(`Sem resposta do modelo ${modelId}`);
          }
          return true;
        }
      );
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Descoberta de modelos filtrada estritamente pela whitelist operacional.
   */
  public async discoverModels(overrideApiKey?: string): Promise<DiscoveredModelInfo[]> {
    const ai = this.getClient(overrideApiKey);
    const modelsPager = await ai.models.list();
    const result: DiscoveredModelInfo[] = [];

    const allowedIds = new Set<string>([
      ...TTS_MODELS_WHITELIST,
      ...FLASH_LITE_MODELS_WHITELIST,
      ...STT_UNARY_MODELS_WHITELIST,
    ]);

    for await (const m of modelsPager) {
      const cleanId = (m.name || '').replace(/^models\//, '');
      if (allowedIds.has(cleanId)) {
        result.push({
          id: cleanId,
          displayName: m.displayName || cleanId,
          description: m.description || '',
          supportedGenerationMethods: m.supportedActions || [],
          discoveredAt: Date.now(),
        });
      }
    }

    return result;
  }
}

export const geminiServerClient = new GeminiServerClient();
