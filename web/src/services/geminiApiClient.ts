/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cliente HTTP Frontend para as Rotas de Servidor /api/.
 * Otimizado com timeouts reais, suporte a AbortSignal e proteção de payloads.
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

const DEFAULT_TIMEOUT_MS = 25000;

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

  private createTimeoutSignal(timeoutMs: number = DEFAULT_TIMEOUT_MS, userSignal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`A requisição excedeu o tempo limite de ${timeoutMs / 1000}s.`));
    }, timeoutMs);

    if (userSignal) {
      if (userSignal.aborted) {
        controller.abort(userSignal.reason);
      } else {
        userSignal.addEventListener('abort', () => {
          controller.abort(userSignal.reason);
        });
      }
    }

    return {
      signal: controller.signal,
      cleanup: () => clearTimeout(timeoutId),
    };
  }

  public async synthesizeSpeech(
    request: TtsSynthesisRequest,
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<{ audioBase64: string; mimeType: string; sampleRate: number }> {
    const headers = await this.getAuthHeaders();
    const { signal, cleanup } = this.createTimeoutSignal(options?.timeoutMs || DEFAULT_TIMEOUT_MS, options?.signal);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal,
      });

      if (!res.ok) {
        let errMessage = `Erro HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.error) errMessage = errData.error;
        } catch {}
        throw new Error(errMessage);
      }

      const data = await res.json();
      if (!data.success || !data.data?.audioBase64) {
        throw new Error(data.error || 'Falha na síntese TTS.');
      }
      return data.data;
    } finally {
      cleanup();
    }
  }

  public async transcribeAudio(
    request: SttTranscriptionRequest,
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<string> {
    const headers = await this.getAuthHeaders();
    const { signal, cleanup } = this.createTimeoutSignal(options?.timeoutMs || DEFAULT_TIMEOUT_MS, options?.signal);

    try {
      const res = await fetch('/api/stt', {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal,
      });

      if (!res.ok) {
        let errMessage = `Erro HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.error) errMessage = errData.error;
        } catch {}
        throw new Error(errMessage);
      }

      const data = await res.json();
      if (!data.success || !data.data?.text) {
        throw new Error(data.error || 'Falha na transcrição STT.');
      }
      return data.data.text;
    } finally {
      cleanup();
    }
  }

  public async analyzeVision(
    imageBase64: string,
    query: string,
    modelId?: string,
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<string> {
    const headers = await this.getAuthHeaders();
    const { signal, cleanup } = this.createTimeoutSignal(options?.timeoutMs || DEFAULT_TIMEOUT_MS, options?.signal);

    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64, query, modelId }),
        signal,
      });

      if (!res.ok) {
        let errMessage = `Erro HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.error) errMessage = errData.error;
        } catch {}
        throw new Error(errMessage);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Falha na análise visual.');
      }
      return data.data.description;
    } finally {
      cleanup();
    }
  }

  public async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const { signal, cleanup } = this.createTimeoutSignal(10000);
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ apiKey }),
        signal,
      });
      cleanup();
      return res.ok;
    } catch {
      return false;
    }
  }

  public async discoverModels(): Promise<DiscoveredModelInfo[]> {
    const headers = await this.getAuthHeaders();
    const { signal, cleanup } = this.createTimeoutSignal(15000);

    try {
      const res = await fetch('/api/models', {
        method: 'GET',
        headers,
        signal,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao buscar modelos.');
      }
      return data.data;
    } finally {
      cleanup();
    }
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
