/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cliente Direct REST para a API Gemini (Google AI Studio) na Extensão Chrome.
 * Utiliza fetch nativo (suportado em Service Worker e MV3) sem dependência de SDK Node.
 * 
 * Segrega estritamente por protocolo:
 * - TTS -> models/gemini-3.8-flash-lite-tts ou gemini-3.8-flash-tts com responseModalities: ["AUDIO"]
 * - STT Unary -> models/gemini-3.5-transcribe com multimodal audio input
 * - Vision -> models/gemini-3.8-flash com image input
 */

import { TtsSynthesisRequest, SttTranscriptionRequest } from '@shared/types/gemini';
import { DiscoveredModelInfo } from '@shared/types/models';
import { getFallbackModelForTask, normalizeModelId } from '@shared/constants/modelsCatalog';
import { base64ToUint8Array, pcmToWav, uint8ArrayToBase64 } from '@shared/utils/pcmWav';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiDirectClient {
  /**
   * Sintetiza fala a partir de texto utilizando os modelos oficiais Gemini TTS.
   */
  public async synthesizeSpeech(
    request: TtsSynthesisRequest,
    apiKey: string
  ): Promise<{ audioBase64: string; mimeType: string; sampleRate: number }> {
    const modelId = normalizeModelId(request.modelId, 'tts');
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
      throw new Error(`Falha na síntese TTS (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const candidatePart = data.candidates?.[0]?.content?.parts?.[0];

    if (!candidatePart?.inlineData?.data) {
      throw new Error('O modelo não retornou dados de áudio na resposta de TTS.');
    }

    const rawBase64 = candidatePart.inlineData.data;
    const rawBytes = base64ToUint8Array(rawBase64);
    let finalBase64 = rawBase64;

    // Se o áudio retornado for PCM Linear puro sem cabeçalho RIFF, encapsula em WAV 24kHz
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
   * Transcreve áudio gravado/estático via protocolo Unary (generateContent com gemini-3.5-transcribe).
   */
  public async transcribeAudio(
    request: SttTranscriptionRequest,
    apiKey: string
  ): Promise<string> {
    const modelId = normalizeModelId(request.modelId, 'stt_unary');
    const endpoint = `${GEMINI_BASE_URL}/models/${modelId}:generateContent?key=${apiKey}`;

    const promptText = request.formattingInstruction
      ? `Transcreva o seguinte áudio respeitando estritamente esta instrução: ${request.formattingInstruction}`
      : 'Transcreva o áudio com pontuação e ortografia correta, sem adicionar introduções ou conclusões.';

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
      throw new Error(`Falha na transcrição STT (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textOutput) {
      throw new Error('Nenhuma transcrição foi gerada a partir do áudio fornecido.');
    }

    return textOutput.trim();
  }

  /**
   * Inspeciona conteúdo visual (captura de tela / Lens) com o modelo multimodal de visão.
   */
  public async inspectVisionContext(
    imageBase64: string,
    instruction: string,
    apiKey: string,
    modelId?: string
  ): Promise<string> {
    const targetModel = normalizeModelId(modelId, 'vision');
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
      throw new Error(`Falha na análise visual Lens (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Testa a validade da chave de API informada pelo usuário.
   */
  public async testApiKey(apiKey: string): Promise<boolean> {
    const fallbackGeneral = getFallbackModelForTask('general');
    const endpoint = `${GEMINI_BASE_URL}/models/${fallbackGeneral}?key=${apiKey}`;
    const response = await fetch(endpoint, { method: 'GET' });
    return response.ok;
  }

  /**
   * Realiza descoberta dinâmica em tempo de execução dos modelos disponíveis na conta.
   */
  public async discoverAvailableModels(apiKey: string): Promise<DiscoveredModelInfo[]> {
    const endpoint = `${GEMINI_BASE_URL}/models?key=${apiKey}`;
    const response = await fetch(endpoint, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Erro ao listar modelos: ${response.statusText}`);
    }
    const data = await response.json();
    const modelsList = data.models || [];

    return modelsList.map((m: Record<string, unknown>) => ({
      id: String(m.name || '').replace(/^models\//, ''),
      displayName: String(m.displayName || ''),
      description: String(m.description || ''),
      supportedGenerationMethods: Array.isArray(m.supportedGenerationMethods)
        ? (m.supportedGenerationMethods as string[])
        : [],
      discoveredAt: Date.now(),
    }));
  }
}

export const geminiDirectClient = new GeminiDirectClient();
