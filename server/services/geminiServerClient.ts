/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Implementação Node.js do Cliente Gemini utilizando o SDK oficial @google/genai.
 * Executa estritamente no backend com suporte a variáveis de ambiente (process.env.GEMINI_API_KEY)
 * e chave opcional enviada pelo cliente no header Authorization ou payload.
 */

import { GoogleGenAI } from '@google/genai';
import { TtsSynthesisRequest, SttTranscriptionRequest } from '@shared/types/gemini';
import { DiscoveredModelInfo } from '@shared/types/models';
import { getFallbackModelForTask, normalizeModelId } from '@shared/constants/modelsCatalog';
import { base64ToUint8Array, pcmToWav, uint8ArrayToBase64 } from '@shared/utils/pcmWav';

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
   * Síntese de fala utilizando os modelos dedicados Gemini TTS.
   */
  public async synthesizeSpeech(
    request: TtsSynthesisRequest,
    overrideApiKey?: string
  ): Promise<{ audioBase64: string; mimeType: string; sampleRate: number }> {
    const ai = this.getClient(overrideApiKey);
    const targetModel = normalizeModelId(request.modelId, 'tts');

    const voiceName = request.voiceName || 'Puck';
    const systemPrompt = request.systemInstruction || 'Natural, clear speech with human breathing pauses';

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: request.text,
              // @ts-ignore - speechMetadata suportado pela API Gemini 3.8 TTS
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
      throw new Error('O modelo não retornou dados de áudio na resposta de TTS.');
    }

    const rawBase64 = candidatePart.inlineData.data;
    const rawBytes = base64ToUint8Array(rawBase64);
    let finalBase64 = rawBase64;

    // Encapsula em WAV 24kHz se não tiver container RIFF
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

  /**
   * Transcrição de áudio via protocolo Unary (gemini-3.5-transcribe).
   */
  public async transcribeAudio(
    request: SttTranscriptionRequest,
    overrideApiKey?: string
  ): Promise<string> {
    const ai = this.getClient(overrideApiKey);
    const targetModel = normalizeModelId(request.modelId, 'stt_unary');

    const instruction = request.formattingInstruction || 'Transcreva com precisão ortográfica e pontuação correta.';

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: request.mimeType || 'audio/wav',
              data: request.audioBase64,
            },
          },
          {
            text: `Transcreva o áudio respeitando: ${instruction}`,
          },
        ],
      },
    });

    const text = response.text || '';
    if (!text) {
      throw new Error('Nenhum texto transcrito retornado pelo modelo.');
    }
    return text.trim();
  }

  /**
   * Análise visual multimodal com gemini-3.8-flash.
   */
  public async analyzeVision(
    imageBase64: string,
    query: string,
    overrideApiKey?: string,
    modelId?: string
  ): Promise<string> {
    const ai = this.getClient(overrideApiKey);
    const targetModel = normalizeModelId(modelId, 'vision');

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
            text: query || 'Descreva detalhadamente o conteúdo desta imagem.',
          },
        ],
      },
    });

    return response.text || '';
  }

  /**
   * Descoberta de modelos disponíveis na API Gemini.
   */
  public async discoverModels(overrideApiKey?: string): Promise<DiscoveredModelInfo[]> {
    const ai = this.getClient(overrideApiKey);
    const modelsPager = await ai.models.list();
    const result: DiscoveredModelInfo[] = [];

    for await (const m of modelsPager) {
      result.push({
        id: (m.name || '').replace(/^models\//, ''),
        displayName: m.displayName || '',
        description: m.description || '',
        supportedGenerationMethods: m.supportedActions || [],
        discoveredAt: Date.now(),
      });
    }

    return result;
  }
}

export const geminiServerClient = new GeminiServerClient();
