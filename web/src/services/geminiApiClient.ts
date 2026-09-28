/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cliente HTTP Frontend para as Rotas de Servidor /api/.
 */

import { TtsSynthesisRequest, SttTranscriptionRequest } from '@shared/types/gemini';
import { DiscoveredModelInfo } from '@shared/types/models';
import { webStorage } from './storage/webStorageAdapter';

export interface ExtensionFileInfo {
  name: string;
  relativePath: string;
  sizeBytes: number;
  isText: boolean;
  content?: string;
  modifiedAt: string;
}

export class GeminiApiClient {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const apiSettings = await webStorage.get('api');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiSettings.apiKey) {
      headers['Authorization'] = `Bearer ${apiSettings.apiKey}`;
    }
    return headers;
  }

  public async synthesizeSpeech(request: TtsSynthesisRequest): Promise<{ audioBase64: string; mimeType: string; sampleRate: number }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Falha na síntese TTS.');
    }
    return data.data;
  }

  public async transcribeAudio(request: SttTranscriptionRequest): Promise<string> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/stt', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Falha na transcrição STT.');
    }
    return data.data.text;
  }

  public async analyzeVision(imageBase64: string, query: string, modelId?: string): Promise<string> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/vision', {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageBase64, query, modelId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Falha na análise visual.');
    }
    return data.data.description;
  }

  public async testApiKey(apiKey: string): Promise<boolean> {
    const res = await fetch('/api/test-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ apiKey }),
    });
    return res.ok;
  }

  public async discoverModels(): Promise<DiscoveredModelInfo[]> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/models', {
      method: 'GET',
      headers,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Falha ao buscar modelos.');
    }
    return data.data;
  }

  public async getExtensionFiles(): Promise<ExtensionFileInfo[]> {
    const res = await fetch('/api/extension/files');
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Falha ao listar arquivos da extensão.');
    }
    return data.data;
  }

  public getDownloadExtensionUrl(): string {
    return '/api/extension/download';
  }
}

export const geminiApi = new GeminiApiClient();
